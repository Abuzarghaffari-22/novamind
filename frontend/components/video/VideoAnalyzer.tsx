"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import {
  Film, Sparkles, X, RefreshCw,
  Copy, Check, Play, Upload,
  HardDrive, Cpu, ChevronRight,
} from "lucide-react";
import { cn }       from "@/lib/utils";
import { videoApi } from "@/services/api";
import Button        from "@/components/ui/Button";
import { Badge }     from "@/components/ui/Badge";
import toast         from "react-hot-toast";

let ReactMarkdown: React.ComponentType<{ children: string; remarkPlugins?: unknown[] }> | null = null;
let remarkGfm: unknown = null;
try {

  ReactMarkdown = require("react-markdown").default;
  
  remarkGfm     = require("remark-gfm").default;
} catch {
 
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="nova-prose text-sm space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="font-semibold text-ink-100 mt-3">{line.slice(4)}</h3>;
        if (line.startsWith("## "))  return <h2 key={i} className="font-semibold text-ink-50  mt-4 text-base">{line.slice(3)}</h2>;
        if (line.startsWith("# "))   return <h1 key={i} className="font-bold   text-ink-50  mt-4 text-lg">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} className="ml-4 text-ink-300 list-disc">{line.slice(2)}</li>;
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 text-ink-300 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-semibold text-ink-100">{line.slice(2, -2)}</p>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-ink-300 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

interface AnalysisResult {
  analysis:     string;
  model:        string;
  file_size_mb: number;
  video_format: string;
}

const PRESETS = [
  {
    label:  "Full Analysis",
    icon:   "✦",
    prompt: "Provide a comprehensive analysis of this video. Describe what is happening, identify key scenes, objects, people, and activities, and summarize the main content clearly.",
  },
  {
    label:  "Scene Summary",
    icon:   "◈",
    prompt: "Describe each distinct scene in this video. For each scene, explain what is happening, where it takes place, and who or what is involved.",
  },
  {
    label:  "Objects & People",
    icon:   "◉",
    prompt: "Identify and list all visible objects, people, animals, text, and items in this video. Be specific about quantities and descriptions.",
  },
  {
    label:  "Activity Report",
    icon:   "◎",
    prompt: "What activities, actions, and events are taking place in this video? Describe each action in chronological order with as much detail as possible.",
  },
  {
    label:  "Key Moments",
    icon:   "◇",
    prompt: "Identify the most significant moments, transitions, or events in this video. Explain what makes each moment important and what it communicates.",
  },
  {
    label:  "Quick Summary",
    icon:   "▷",
    prompt: "Give me a concise 3-5 sentence summary of this video. What is the core message or content?",
  },
] as const;

const ACCEPT_TYPES = {
  "video/mp4":        [".mp4"],
  "video/quicktime":  [".mov"],
  "video/x-msvideo":  [".avi"],
  "video/webm":       [".webm"],
  "video/x-matroska": [".mkv"],
  "video/x-flv":      [".flv"],
  "video/x-ms-wmv":   [".wmv"],
  "video/3gpp":       [".3gp"],
};

const MAX_MB = 25;

const SPIN_STYLE_ID = "novamind-video-spin";
function useSpinKeyframe() {
  useEffect(() => {
    if (document.getElementById(SPIN_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = SPIN_STYLE_ID;
    style.textContent = `
      @keyframes novaSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
     
    };
  }, []);
}

export default function VideoAnalyzer() {
  useSpinKeyframe();

  const [videoFile,    setVideoFile]    = useState<File | null>(null);
  const [videoUrl,     setVideoUrl]     = useState<string | null>(null);
  const [prompt,       setPrompt]       = useState(PRESETS[0].prompt);
  const [activePreset, setActivePreset] = useState(0);
  const [result,       setResult]       = useState<AnalysisResult | null>(null);
  const [isAnalysing,  setIsAnalysing]  = useState(false);
  const [copied,       setCopied]       = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setResult(null);
  }, [videoUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   ACCEPT_TYPES,
    maxFiles: 1,
    maxSize:  MAX_MB * 1024 * 1024,
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors[0]?.code;
      if (code === "file-too-large")
        toast.error(`File exceeds ${MAX_MB} MB limit.`);
      else
        toast.error("Unsupported format. Use MP4, MOV, AVI, MKV, WEBM, WMV, or FLV.");
    },
  });

  const handleAnalyse = async () => {
    if (!videoFile) return;
    setIsAnalysing(true);
    setResult(null);
    try {
      const res = await videoApi.analyze(videoFile, prompt);
      setResult({
        analysis:     res.analysis,
        model:        res.model,
        file_size_mb: res.file_size_mb,
        video_format: res.video_format,
      });
    } catch (err) {
      toast.error(`Analysis failed: ${(err as Error).message}`);
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setResult(null);
  };

  const selectPreset = (idx: number) => {
    setActivePreset(idx);
    setPrompt(PRESETS[idx].prompt);
  };

  const fileExt = videoFile?.name.split(".").pop()?.toUpperCase() ?? "";

  const { ref: dropRef, onAnimationStart: _oas, ...dropRootProps } = getRootProps();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-5 h-full overflow-hidden">

      <div className="flex flex-col gap-4 overflow-y-auto pr-1 pb-2">

        <AnimatePresence mode="wait">
          {!videoUrl ? (

            <motion.div
              key="dropzone"
              ref={dropRef as React.RefObject<HTMLDivElement>}
              {...dropRootProps}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-4 rounded-2xl",
                "border-2 border-dashed cursor-pointer transition-all duration-200",
                "min-h-[200px] p-8 text-center overflow-hidden",
                isDragActive
                  ? "border-nova-500/60 bg-nova-950/20 shadow-nova-sm"
                  : "border-ink-800 hover:border-nova-700/40 hover:bg-ink-900/20",
              )}
            >
              <input {...getInputProps()} />
              <div className="absolute inset-0 bg-grid opacity-[0.12] pointer-events-none" />

              <AnimatePresence mode="wait">
                {isDragActive ? (
                  <motion.div
                    key="drag"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 flex flex-col items-center gap-3"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-14 h-14 rounded-2xl bg-nova-600/20 border border-nova-500/30 flex items-center justify-center"
                    >
                      <Film size={22} className="text-nova-400" />
                    </motion.div>
                    <p className="text-nova-300 font-display font-semibold">Release to upload</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative z-10 flex flex-col items-center gap-3"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-ink-800/80 border border-ink-700/50 flex items-center justify-center">
                      <Upload size={20} className="text-ink-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-ink-200 font-display font-semibold text-sm">
                        Drop a video or click to browse
                      </p>
                      <p className="text-ink-600 text-xs">
                        MP4 · MOV · AVI · MKV · WEBM · WMV · FLV — max {MAX_MB} MB
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          ) : (

            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-2xl overflow-hidden border border-ink-800/60 bg-ink-950 group"
            >
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full max-h-[280px] object-contain"
                style={{ background: "rgb(13 14 20)" }}
              />

              <button
                onClick={handleClear}
                className={cn(
                  "absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center",
                  "bg-ink-900/80 backdrop-blur border border-ink-700 text-ink-400",
                  "opacity-0 group-hover:opacity-100 transition-all duration-150",
                  "hover:bg-rose-950/80 hover:border-rose-700/60 hover:text-rose-400",
                )}
                title="Remove video"
              >
                <X size={12} />
              </button>

              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-ink-950/90 to-transparent flex items-center gap-2">
                <Badge variant="nova" className="text-[10px] gap-1">
                  <Film size={8} />
                  {fileExt}
                </Badge>
                <Badge variant="default" className="text-[10px] gap-1">
                  <HardDrive size={8} />
                  {videoFile ? (videoFile.size / (1024 * 1024)).toFixed(1) : "—"} MB
                </Badge>
                <span className="text-[11px] text-ink-600 truncate ml-1 flex-1 text-right">
                  {videoFile?.name}
                </span>
              </div>
            </motion.div>

          )}
        </AnimatePresence>

        <div className="space-y-2">
          <p className="text-[11px] text-ink-600 font-medium uppercase tracking-wide">
            Analysis Mode
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => selectPreset(i)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium",
                  "transition-all duration-150 text-left",
                  activePreset === i
                    ? "bg-nova-900/25 border-nova-700/40 text-nova-300"
                    : "border-ink-800/50 text-ink-600 hover:text-ink-300 hover:border-ink-700",
                )}
              >
                <span className="text-[10px] opacity-60">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] text-ink-600 font-medium uppercase tracking-wide">
            Prompt
          </p>
          <textarea
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setActivePreset(-1); }}
            rows={3}
            className={cn(
              "w-full glass rounded-xl border border-ink-800/50 px-4 py-3 text-sm resize-none",
              "text-ink-200 placeholder:text-ink-700",
              "focus:outline-none focus:border-nova-500/40 transition-colors",
            )}
            placeholder="Ask anything about the video…"
          />
        </div>

        <Button
          onClick={handleAnalyse}
          disabled={!videoFile}
          loading={isAnalysing}
          size="lg"
          className="w-full"
        >
          <Sparkles size={14} />
          {isAnalysing ? "Analysing with Nova Pro…" : "Analyse Video"}
        </Button>
      </div>

      <div className="glass rounded-2xl border border-ink-800/50 flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-nova-900/40 border border-nova-800/30 flex items-center justify-center">
              <Film size={10} className="text-nova-400" />
            </div>
            <span className="text-sm font-medium text-ink-200">Video Analysis</span>
            {result && (
              <>
                <Badge variant="success">Done</Badge>
                <Badge variant="nova" className="text-[10px] gap-1">
                  <Cpu size={8} />
                  {result.model}
                </Badge>
              </>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-200 transition-colors"
              >
                {copied
                  ? <><Check size={11} className="text-emerald-400" /> Copied</>
                  : <><Copy size={11} /> Copy</>}
              </button>
              <button
                onClick={handleAnalyse}
                disabled={isAnalysing}
                className="text-ink-600 hover:text-ink-300 transition-colors disabled:opacity-30"
                title="Re-analyse"
              >
                <RefreshCw size={12} className={isAnalysing ? "animate-spin" : ""} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {isAnalysing && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-6 py-16 px-8"
              >
                <div className="relative w-20 h-20 shrink-0">
                  <div className="absolute inset-0 rounded-full border border-ink-800" />
                  <svg
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: "rotate(-90deg)" }}
                    viewBox="0 0 80 80"
                  >
                    <circle
                      cx="40" cy="40" r="36"
                      fill="none"
                      stroke="rgba(99,112,241,0.5)"
                      strokeWidth="2"
                      strokeDasharray="226"
                      strokeDashoffset="160"
                      strokeLinecap="round"
                      style={{ animation: "novaSpin 1.6s linear infinite" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film size={20} className="text-nova-400" />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-ink-200 text-sm font-semibold font-display">
                    Nova Pro is analysing your video
                  </p>
                  <p className="text-ink-600 text-xs leading-relaxed max-w-[260px]">
                    Sampling frames · Understanding content · Generating insights
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                  {["Reading video frames", "Understanding context", "Generating analysis"].map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.4 + 0.3 }}
                      className="flex items-center gap-2.5 text-xs text-ink-600"
                    >
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-nova-500/50 shrink-0"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.4 }}
                      />
                      {step}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {!isAnalysing && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="p-5"
              >
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-800/40">
                  <Badge variant="default" className="text-[10px] gap-1">
                    <HardDrive size={8} />
                    {result.file_size_mb} MB
                  </Badge>
                  <Badge variant="default" className="text-[10px]">
                    {result.video_format.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-ink-700 ml-auto">
                    Powered by Amazon Nova
                  </span>
                </div>

                {ReactMarkdown && remarkGfm ? (
                  <div className="nova-prose text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.analysis}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <SimpleMarkdown text={result.analysis} />
                )}
              </motion.div>
            )}

            {!isAnalysing && !result && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-5 py-16 px-8 text-center"
              >
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-2xl bg-ink-800/50 border border-ink-700/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play size={20} className="text-ink-700 translate-x-0.5" />
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg bg-ink-900 border border-ink-800 flex items-center justify-center">
                    <Sparkles size={10} className="text-nova-600" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-ink-400 text-sm font-medium font-display">No analysis yet</p>
                  <p className="text-ink-700 text-xs leading-relaxed max-w-[200px]">
                    Upload a video and choose an analysis mode to get started
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
                  {[
                    "Scene understanding",
                    "Object & activity detection",
                    "Natural language summary",
                  ].map(cap => (
                    <div key={cap} className="flex items-center gap-2 text-[11px] text-ink-700">
                      <ChevronRight size={10} className="text-nova-800 shrink-0" />
                      {cap}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
