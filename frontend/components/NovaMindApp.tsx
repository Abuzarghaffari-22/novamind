"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, RefreshCw, Search, BarChart3, FileText,
  Layers, BookOpen, X, ChevronDown,
  Volume2, VolumeX, Send, Mic2,
} from "lucide-react";
import { useChat }      from "@/hooks/useChat";
import { useVoice }     from "@/hooks/useVoice";
import { useDocuments } from "@/hooks/useDocuments";
import Sidebar          from "@/components/layout/Sidebar";
import MessageBubble    from "@/components/chat/MessageBubble";
import ChatInput        from "@/components/chat/ChatInput";
import VoiceOrb         from "@/components/voice/VoiceOrb";
import DocumentUpload   from "@/components/documents/DocumentUpload";
import ImageAnalyzer    from "@/components/image/ImageAnalyzer";
import VideoAnalyzer    from "@/components/video/VideoAnalyzer";   // ← VIDEO ADDED
import Button           from "@/components/ui/Button";
import StatCard         from "@/components/ui/StatCard";
import ThemeToggle      from "@/components/ui/ThemeToggle";
import { Badge }        from "@/components/ui/Badge";
import { cn }           from "@/lib/utils";
import toast            from "react-hot-toast";
import type { ActiveTab, VoiceTranscript } from "@/types";

// ── Tab metadata ──────────────────────────────────────────────────────────
const TAB_META: Record<ActiveTab, { title: string; desc: (x: unknown) => string }> = {
  chat:      { title: "AI Chat",          desc: (n) => `${n} messages`          },
  voice:     { title: "Voice Assistant",  desc: (s) => `Nova Sonic · ${s}`      },
  documents: { title: "Knowledge Base",   desc: () => ""                        },
  image:     { title: "Vision Analysis",  desc: () => "Nova Lite · multimodal"  },
  video:     { title: "Video Analysis",   desc: () => "Nova Pro · multimodal"   },  // ← VIDEO ADDED
};

// ═════════════════════════════════════════════════════════════════════════
export default function NovaMindApp() {
  const [activeTab,     setActiveTab]     = useState<ActiveTab>("chat");
  const [sidebarClosed, setSidebarClosed] = useState(false);
  const [docSearch,     setDocSearch]     = useState("");
  const [showDocSearch, setShowDocSearch] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState(false);

  const chat  = useChat();
  const voice = useVoice();
  const docs  = useDocuments();

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  useEffect(() => {
    if (activeTab === "documents")
      docs.loadKBData().catch(() => toast.error("Failed to load KB"));
  }, [activeTab]); // eslint-disable-line

  useEffect(() => {
    if (voiceResponse && !voice.isConnected) {
      voice.connect();
      toast.success("🔊 Voice responses ON — Nova Sonic will speak every reply");
    }
  }, [voiceResponse]); // eslint-disable-line

  useEffect(() => {
    if (!voiceResponse || !voice.isConnected) return;
    const last = [...chat.messages]
      .reverse()
      .find(m => m.role === "assistant" && !m.isStreaming && m.content.trim());
    if (!last || last.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    const plain = last.content
      .replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
    if (plain) voice.sendTextInput(plain);
  }, [chat.messages, voiceResponse, voice.isConnected, voice.sendTextInput]);

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== "voice" && voice.isConnected && !voiceResponse) voice.disconnect();
  }, [voice, voiceResponse]);

  const handleDocSearch = async () => {
    if (!docSearch.trim()) return;
    await docs.search(docSearch, 5);
  };

  const meta = TAB_META[activeTab];

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100">

      {/* Ambient FX */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full bg-nova-950/50 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-cyan/[0.04] blur-[120px]" />
        <div className="bg-grid absolute inset-0 opacity-[0.15]" />
      </div>

      <Sidebar activeTab={activeTab} onTabChange={handleTabChange}
               collapsed={sidebarClosed} onToggle={() => setSidebarClosed(v => !v)} />

      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.22,1,0.36,1] }}
          className="flex items-center justify-between px-6 py-3.5 border-b border-ink-800/50 glass shrink-0 z-10"
        >
          <div>
            <h2 className="font-display font-semibold text-ink-50 text-base leading-none">
              {meta.title}
            </h2>
            <p className="text-[11px] text-ink-600 mt-0.5">
              {activeTab === "chat"      && meta.desc(chat.messages.length)}
              {activeTab === "voice"     && meta.desc(voice.status)}
              {activeTab === "documents" && docs.kbStats
                && `${docs.kbStats.total_chunks} chunks · ${docs.kbStats.unique_sources} sources`}
              {activeTab === "image"     && meta.desc(null)}
              {activeTab === "video"     && meta.desc(null)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "chat" && (
              <>
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setVoiceResponse(v => !v)}
                  title={voiceResponse ? "Disable voice responses" : "AI will speak every reply via Nova Sonic"}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-500",
                    voiceResponse
                      ? "dark:bg-violet-900/30 dark:border-violet-500/50 dark:text-violet-200 bg-violet-600 border-violet-700 text-white shadow-[0_2px_12px_rgba(124,58,237,0.35)]"
                      : "dark:border-ink-700/60 dark:text-ink-500 dark:hover:text-ink-200 dark:hover:border-ink-500 border-ink-700/40 text-ink-500 hover:text-ink-200 hover:border-nova-500/50",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {voiceResponse ? (
                      <motion.span key="on" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5">
                        <Volume2 size={12} className="animate-pulse" />Voice ON
                      </motion.span>
                    ) : (
                      <motion.span key="off" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5">
                        <VolumeX size={12} />Voice OFF
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <Button variant="ghost" size="sm" onClick={chat.clearSession}>
                  <Trash2 size={13} />Clear
                </Button>
              </>
            )}

            {activeTab === "documents" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowDocSearch(v => !v)}>
                  <Search size={13} />Search
                </Button>
                <Button variant="ghost" size="sm" onClick={docs.loadKBData} loading={docs.isLoading}>
                  <RefreshCw size={13} />Refresh
                </Button>
              </>
            )}

            <ThemeToggle />
          </div>
        </motion.header>

        {/* Voice response banner */}
        <AnimatePresence>
          {voiceResponse && activeTab === "chat" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden shrink-0"
            >
              <div className={cn(
                "flex items-center gap-3 px-6 py-2 border-b text-xs",
                "dark:border-violet-800/30 dark:bg-violet-950/20 border-violet-200 bg-violet-50",
              )}>
                <span className={cn("flex items-center gap-1.5 font-medium",
                  "dark:text-violet-300 text-violet-700")}>
                  <Volume2 size={11} className="animate-pulse" />
                  <strong>Voice Response active</strong>
                  <span className="dark:text-violet-400 text-violet-500 font-normal">
                    — NovaMind speaks every reply via Nova Sonic
                  </span>
                </span>
                {voice.status === "connecting" && <span className="ml-auto text-amber-600 dark:text-amber-400">{voice.retryCount > 0 ? `Retry ${voice.retryCount}/3…` : "Connecting…"}</span>}
                {voice.status === "speaking"   && <span className="ml-auto text-violet-600 dark:text-violet-400 animate-pulse">Speaking…</span>}
                {voice.error                   && <span className="ml-auto text-rose-500 truncate max-w-[220px]">{voice.error}</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tab panels ──────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 18  }}
            animate={{ opacity: 1, x: 0   }}
            exit={{    opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: [0.22,1,0.36,1] }}
            className="flex-1 overflow-hidden flex flex-col"
          >

            {/* ══ CHAT ════════════════════════════════════════════ */}
            {activeTab === "chat" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {chat.messages.length === 0 ? (
                    <EmptyChat onExample={chat.sendMessage}
                               voiceResponseEnabled={voiceResponse}
                               onEnableVoice={() => setVoiceResponse(true)} />
                  ) : (
                    chat.messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="px-6 pb-5 pt-3 border-t border-ink-800/40 shrink-0">
                  <ChatInput onSend={chat.sendMessage} isLoading={chat.isLoading}
                             settings={chat.settings} onSettings={chat.setSettings} />
                </div>
              </div>
            )}

            {/* ══ VOICE ═══════════════════════════════════════════ */}
            {activeTab === "voice" && (
              <div className="flex h-full">
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
                  <VoiceOrb
                    status={voice.status}
                    audioLevel={voice.audioLevel}
                    onConnect={voice.connect}
                    onDisconnect={voice.disconnect}
                    onStartListen={voice.startListening}
                    onStopListen={voice.stopListening}
                  />
                  <AnimatePresence>
                    {voice.isConnected && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0  }}
                        exit={{    opacity: 0, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.22,1,0.36,1] }}
                        className="w-full max-w-md"
                      >
                        <VoiceTextInput
                          onSend={voice.sendTextInput}
                          disabled={voice.status === "processing" || voice.status === "speaking"}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!voice.isConnected && voice.status !== "connecting" && (
                    <p className="text-xs text-ink-700 text-center max-w-xs leading-relaxed">
                      Click the orb to connect Nova Sonic — then speak by holding the orb,
                      or type a message in the field below
                    </p>
                  )}
                  {voice.error && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="glass rounded-xl border border-rose-800/40 px-4 py-3 max-w-md"
                    >
                      <p className="text-xs text-rose-400 leading-relaxed">{voice.error}</p>
                      {voice.status === "error" && (
                        <button onClick={voice.reconnect} className="mt-2 text-xs text-nova-400 hover:text-nova-300 transition-colors">
                          Try again →
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
                <div className="w-72 border-l border-ink-800/50 glass flex flex-col">
                  <div className="px-5 py-4 border-b border-ink-800/50 shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-ink-200">Transcript</p>
                      {voice.transcripts.length > 0 && (
                        <span className="text-[11px] text-ink-600">{voice.transcripts.length} msgs</span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-700 mt-0.5">Speech-to-speech + text-to-voice</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                    {voice.transcripts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                        <Mic2 size={20} className="text-ink-800" />
                        <p className="text-xs text-ink-700 leading-relaxed max-w-[160px]">
                          Connect the orb then speak or type — conversation appears here
                        </p>
                      </div>
                    ) : (
                      voice.transcripts.map((t: VoiceTranscript) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "rounded-xl px-3 py-2 text-xs leading-relaxed",
                            t.role === "user"
                              ? "bg-nova-950/40 border border-nova-800/30 text-nova-200 ml-4"
                              : "bg-ink-900/60 border border-ink-800/40 text-ink-300 mr-4"
                          )}
                        >
                          <p className={cn(
                            "text-[10px] font-semibold mb-1 uppercase tracking-wide",
                            t.role === "user" ? "text-nova-500" : "text-violet-500"
                          )}>
                            {t.role === "user" ? "You" : "NovaMind"}
                          </p>
                          {t.text}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ DOCUMENTS ═══════════════════════════════════════ */}
            {activeTab === "documents" && (
              <div className="flex h-full overflow-hidden">
                <div className="w-80 shrink-0 border-r border-ink-800/50 p-5 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-ink-200 mb-3">Upload Files</h3>
                  <DocumentUpload onUploaded={docs.loadKBData} />
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <AnimatePresence>
                    {showDocSearch && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                            <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleDocSearch()}
                              placeholder="Semantic search…"
                              className="w-full glass rounded-xl border-ink-800/50 pl-10 pr-4 py-2.5 text-sm text-ink-200 placeholder:text-ink-700 focus:outline-none focus:border-nova-500/35" />
                          </div>
                          <Button size="sm" onClick={handleDocSearch} loading={docs.isSearching}>Search</Button>
                          <Button size="icon" variant="ghost" onClick={() => { docs.clearSearch(); setDocSearch(""); }}><X size={14} /></Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {docs.searchResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{docs.searchResults.length} results</p>
                        <button onClick={docs.clearSearch} className="text-xs text-ink-600 hover:text-ink-300 transition-colors">Clear</button>
                      </div>
                      {docs.searchResults.map(r => (
                        <div key={r.doc_id} className="glass rounded-xl border-ink-800/50 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="nova">#{r.rank}</Badge>
                            <span className="text-xs text-ink-500 truncate">{r.source}</span>
                            <span className="text-xs text-emerald-500 ml-auto">{(r.score*100).toFixed(0)}%</span>
                          </div>
                          <p className="text-xs text-ink-300 leading-relaxed line-clamp-3">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {docs.kbStats && !docs.searchResults.length && (
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <StatCard label="Total Chunks"  value={docs.kbStats.total_chunks}                    icon={<BarChart3 size={15}/>} color="nova"    delay={0}    />
                      <StatCard label="Sources"       value={docs.kbStats.unique_sources}                  icon={<FileText  size={15}/>} color="amber"   delay={0.05} />
                      <StatCard label="File Types"    value={Object.keys(docs.kbStats.by_type).length}     icon={<Layers    size={15}/>} color="cyan"    delay={0.1}  />
                      <StatCard label="Indexed"       value="FAISS"                                        icon={<BookOpen  size={15}/>} color="emerald" delay={0.15} />
                    </div>
                  )}
                  {!docs.searchResults.length && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
                        {docs.documents.length} document{docs.documents.length !== 1 ? "s" : ""}
                      </p>
                      {docs.documents.length === 0 && !docs.isLoading ? (
                        <div className="text-center py-16">
                          <FileText size={28} className="text-ink-800 mx-auto mb-3" />
                          <p className="text-ink-600 text-sm">No documents yet.</p>
                          <p className="text-ink-700 text-xs mt-1">Upload files using the panel on the left.</p>
                        </div>
                      ) : docs.documents.map((doc, i) => (
                        <motion.div key={doc.source} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          className="glass rounded-xl border-ink-800/50 p-4 flex items-center gap-4 hover:border-nova-700/30 transition-colors">
                          <div className="w-9 h-9 rounded-xl bg-ink-800/80 border border-ink-700/50 flex items-center justify-center shrink-0">
                            <FileText size={15} className="text-nova-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink-100 font-medium truncate">{doc.source}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="nova">{doc.doc_type}</Badge>
                              <span className="text-xs text-ink-600">{doc.chunk_count} chunks</span>
                            </div>
                          </div>
                          <ChevronDown size={13} className="text-ink-700 shrink-0 -rotate-90" />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ IMAGE ═══════════════════════════════════════════ */}
            {activeTab === "image" && (
              <div className="flex-1 overflow-hidden p-5"><ImageAnalyzer /></div>
            )}

            {/* ══ VIDEO ═══════════════════════════════════════════ */}  {/* ← VIDEO ADDED */}
            {activeTab === "video" && (
              <div className="flex-1 overflow-hidden p-5"><VideoAnalyzer /></div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── VoiceTextInput ────────────────────────────────────────────────────────
function VoiceTextInput({
  onSend, disabled = false,
}: { onSend: (t: string) => void; disabled?: boolean }) {
  const [text, setText]         = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t); setLastSent(t); setText("");
    setTimeout(() => setLastSent(null), 3000);
    inputRef.current?.focus();
  }, [text, disabled, onSend]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-ink-800/50" />
        <span className="text-[11px] text-ink-600 flex items-center gap-1 select-none">
          <Mic2 size={9} className="text-ink-700" />or type a message
        </span>
        <div className="flex-1 h-px bg-ink-800/50" />
      </div>
      <div className={cn(
        "flex items-center gap-2 glass rounded-2xl border px-4 py-2.5 transition-colors",
        disabled ? "border-ink-800/30 opacity-50" : "border-ink-700/50 focus-within:border-nova-500/50",
      )}>
        <input
          ref={inputRef} value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={disabled}
          placeholder={disabled ? "Nova is responding…" : "Type a message — Nova will speak the answer…"}
          className="flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-700 focus:outline-none disabled:cursor-not-allowed"
        />
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={send}
          disabled={!text.trim() || disabled}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl transition-all",
            text.trim() && !disabled
              ? "bg-nova-600 hover:bg-nova-500 text-white"
              : "bg-ink-800/50 text-ink-700 cursor-not-allowed",
          )}
        >
          <Send size={13} />
        </motion.button>
      </div>
      <AnimatePresence>
        {lastSent && (
          <motion.p key={lastSent} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-[11px] text-ink-600 text-center truncate px-2">
            Sent: &ldquo;{lastSent}&rdquo;
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Empty chat ────────────────────────────────────────────────────────────
const EXAMPLES = [
  { q: "What documents are in the knowledge base?",         label: "Browse KB",    color: "nova"   },
  { q: "Explain how Amazon Nova Sonic voice AI works",      label: "Learn Nova",   color: "cyan"   },
  { q: "Summarize the most recently uploaded document",     label: "Summarize",    color: "amber"  },
  { q: "What multimodal capabilities does NovaMind have?", label: "Capabilities", color: "violet" },
] as const;

function EmptyChat({
  onExample, voiceResponseEnabled, onEnableVoice,
}: { onExample: (q: string) => void; voiceResponseEnabled: boolean; onEnableVoice: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
      className="flex flex-col items-center justify-center h-full py-8 text-center px-6">
      <motion.div animate={{ y: [0,-10,0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-nova-500 via-nova-600 to-accent-cyan shadow-nova-lg" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-nova-500 to-accent-cyan blur-2xl opacity-50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-black text-3xl text-white relative z-10">N</span>
        </div>
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="font-display font-bold text-4xl text-ink-50 mb-3">
        Hello, I&apos;m <span className="text-gradient">NovaMind</span>
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
        className="text-ink-500 text-base mb-6 max-w-lg leading-relaxed">
        Enterprise-grade multimodal AI powered by Amazon Nova.
        Chat, analyse images, search documents, and have real-time voice conversations.
      </motion.p>
      {!voiceResponseEnabled && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          onClick={onEnableVoice}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-all mb-8",
            "dark:border-violet-600/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-900/30",
            "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
          )}>
          <Volume2 size={14} />Enable Voice Responses — hear Nova Sonic speak every reply
        </motion.button>
      )}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
        {EXAMPLES.map((ex, i) => (
          <motion.button key={ex.q} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 + i * 0.07 }}
            onClick={() => onExample(ex.q)} className="glass glass-hover rounded-xl border-ink-800/50 px-4 py-3.5 text-left group">
            <p className={cn("text-[11px] font-semibold mb-1.5 uppercase tracking-wide",
              ex.color === "nova" ? "text-nova-500" : ex.color === "cyan" ? "text-cyan-500" : ex.color === "amber" ? "text-amber-500" : "text-violet-500")}>
              {ex.label}
            </p>
            <p className="text-sm text-ink-400 group-hover:text-ink-200 transition-colors leading-snug">{ex.q}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}