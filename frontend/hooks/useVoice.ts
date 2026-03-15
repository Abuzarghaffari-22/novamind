"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { createVoiceSocket } from "@/services/api";
import type { VoiceStatus, VoiceTranscript } from "@/types";

const WORKLET_SOURCE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this._buf = []; this._target = 1600; }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]);
    while (this._buf.length >= this._target) {
      const chunk = this._buf.splice(0, this._target);
      const pcm = new Int16Array(this._target);
      for (let i = 0; i < this._target; i++)
        pcm[i] = Math.max(-32768, Math.min(32767, chunk[i] * 32768));
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
`;
const mkWorkletUrl = () =>
  URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));

function ab2b64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b642ab(b64: string): ArrayBuffer {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

const IN_HZ  = 16_000;   // Nova input:  valid values 8000 | 16000
const OUT_HZ = 24_000;   // Nova output: valid values 8000 | 24000  (NOT 16000)
const LVL_MS = 50;
const MAX_RETRY  = 3;
const RETRY_BASE = 1_000;

export interface UseVoiceReturn {
  status:         VoiceStatus;
  transcripts:    VoiceTranscript[];
  connect:        () => void;
  disconnect:     () => void;
  reconnect:      () => void;
  startListening: () => void;
  stopListening:  () => void;
  sendTextInput:  (text: string) => void;
  error:          string | null;
  isConnected:    boolean;
  audioLevel:     number;
  retryCount:     number;
}

export function useVoice(): UseVoiceReturn {
  const [status,      setStatus]      = useState<VoiceStatus>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [error,       setError]       = useState<string | null>(null);
  const [audioLevel,  setAudioLevel]  = useState(0);
  const [retryCount,  setRetryCount]  = useState(0);

  const statusRef = useRef<VoiceStatus>("idle");
  const ss = useCallback((s: VoiceStatus) => { statusRef.current = s; setStatus(s); }, []);

  const wsRef          = useRef<WebSocket | null>(null);
  const retryRef       = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureCtxRef  = useRef<AudioContext | null>(null);
  const workletRef     = useRef<AudioWorkletNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const workletUrlRef  = useRef<string | null>(null);
  const levelTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksSentRef  = useRef(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const queueRef       = useRef<ArrayBuffer[]>([]);
  const playingRef     = useRef(false);
  const schedEndRef    = useRef(0);

  const addTx = useCallback((role: "user" | "assistant", text: string) => {
    setTranscripts(p => [...p, { id: uuidv4(), role, text, timestamp: new Date() }]);
  }, []);

  const playNext = useCallback(() => {
    const ctx = playbackCtxRef.current;
    if (!ctx || !queueRef.current.length) {
      if (statusRef.current === "speaking") ss("ready");
      playingRef.current = false; return;
    }
    playingRef.current = true; ss("speaking");
    const pcm16 = new Int16Array(queueRef.current.shift()!);
    const f32   = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, OUT_HZ);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime, schedEndRef.current);
    src.start(t); schedEndRef.current = t + buf.duration;
    src.onended = () => {
      if (!queueRef.current.length) { playingRef.current = false; if (statusRef.current === "speaking") ss("ready"); }
      else playNext();
    };
  }, [ss]);

  const enqueue = useCallback((buf: ArrayBuffer) => {
    queueRef.current.push(buf);
    if (!playingRef.current) playNext();
  }, [playNext]);

  const _connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    ss("connecting"); setError(null);

    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed")
      playbackCtxRef.current = new AudioContext({ sampleRate: OUT_HZ });
    schedEndRef.current = 0; queueRef.current = []; playingRef.current = false;

    const ws = createVoiceSocket();
    wsRef.current = ws;

    ws.onopen = () => { playbackCtxRef.current?.resume().catch(() => null); };

    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(e.data); } catch { return; }

      switch (ev.type as string) {
        case "audio_chunk":
          if (typeof ev.data === "string" && ev.data) enqueue(b642ab(ev.data));
          break;
        case "text_chunk":
          if (typeof ev.data === "string" && ev.data)
            addTx(ev.role === "user" ? "user" : "assistant", ev.data);
          break;
        case "user":
          if (typeof ev.data === "string" && ev.data) addTx("user", ev.data);
          break;
        case "turn_complete":
          if (!queueRef.current.length && !playingRef.current) ss("ready");
          break;
        case "session_id":
          break;
        case "greeting_start":
          playbackCtxRef.current?.resume().catch(() => null);
          ss("ready");
          break;
        case "error": {
          const msg = (ev.message as string) ?? "Voice error";
          const attempt = retryRef.current + 1;
          if (attempt <= MAX_RETRY) {
            retryRef.current = attempt; setRetryCount(attempt);
            setError(`Reconnecting (${attempt}/${MAX_RETRY})…`); ss("connecting");
            wsRef.current?.close(); wsRef.current = null;
            retryTimerRef.current = setTimeout(() => { retryTimerRef.current = null; _connect(); },
              RETRY_BASE * Math.pow(2, attempt - 1));
          } else { setError(msg); ss("error"); }
          break;
        }
        default: break;
      }
    };

    ws.onerror = () => { setError("WebSocket connection failed — is the backend running?"); ss("error"); };
    ws.onclose = () => { if (statusRef.current !== "error") ss("idle"); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTx, enqueue, ss]);

  const connect = useCallback(() => { retryRef.current = 0; setRetryCount(0); _connect(); }, [_connect]);

  const reconnect = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (wsRef.current) { wsRef.current.onclose = null; try { wsRef.current.close(); } catch {} wsRef.current = null; }
    retryRef.current = 0; setRetryCount(0); _connect();
  }, [_connect]);

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (levelTimerRef.current) { clearInterval(levelTimerRef.current); levelTimerRef.current = null; }
    workletRef.current?.disconnect(); workletRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    captureCtxRef.current?.close().catch(() => null); captureCtxRef.current = null;
    if (workletUrlRef.current) { URL.revokeObjectURL(workletUrlRef.current); workletUrlRef.current = null; }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      try { wsRef.current.send(JSON.stringify({ type: "session_end" })); } catch {}
      wsRef.current.close(); wsRef.current = null;
    }
    playbackCtxRef.current?.close().catch(() => null); playbackCtxRef.current = null;
    queueRef.current = []; playingRef.current = false; schedEndRef.current = 0;
    chunksSentRef.current = 0; retryRef.current = 0; setRetryCount(0);
    ss("idle"); setAudioLevel(0);
  }, [ss]);

  const startListening = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || statusRef.current !== "ready") return;
    chunksSentRef.current = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: IN_HZ, channelCount: 1,
                 echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: IN_HZ });
      captureCtxRef.current = ctx;
      const url = mkWorkletUrl(); workletUrlRef.current = url;
      await ctx.audioWorklet.addModule(url);
      const src = ctx.createMediaStreamSource(stream);
      const wk  = new AudioWorkletNode(ctx, "pcm-capture-processor");
      workletRef.current = wk;
      wk.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "audio_chunk", data: ab2b64(e.data) }));
        chunksSentRef.current++;
      };
      src.connect(wk);
      const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const da = new Uint8Array(an.frequencyBinCount);
      levelTimerRef.current = setInterval(() => {
        an.getByteFrequencyData(da);
        setAudioLevel(da.reduce((a, b) => a + b, 0) / da.length / 128);
      }, LVL_MS);
      ss("listening");
    } catch (err) { setError(`Mic error: ${(err as Error).message}`); ss("error"); }
  }, [ss]);

  const stopListening = useCallback(() => {
    const ws = wsRef.current;
    if (statusRef.current !== "listening") return;
    if (levelTimerRef.current) { clearInterval(levelTimerRef.current); levelTimerRef.current = null; }
    setAudioLevel(0);
    setTimeout(() => {
      workletRef.current?.disconnect(); workletRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
      captureCtxRef.current?.close().catch(() => null); captureCtxRef.current = null;
      if (workletUrlRef.current) { URL.revokeObjectURL(workletUrlRef.current); workletUrlRef.current = null; }
      if (ws?.readyState !== WebSocket.OPEN) return;
      if (chunksSentRef.current > 0) {
        ws.send(JSON.stringify({ type: "audio_complete" }));
      } else {
        ws.send(JSON.stringify({ type: "audio_cancel" }));
        ss("ready"); return;
      }
    }, 80);
    ss("processing");
  }, [ss]);

  const sendTextInput = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
    playbackCtxRef.current?.resume().catch(() => null);
    ws.send(JSON.stringify({ type: "text_input", text: text.trim() }));
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    status, transcripts, connect, disconnect, reconnect,
    startListening, stopListening, sendTextInput,
    error, isConnected: !["idle","error","connecting"].includes(status),
    audioLevel, retryCount,
  };
}