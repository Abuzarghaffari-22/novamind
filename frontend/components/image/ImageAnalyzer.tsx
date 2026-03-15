"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { Image as ImageIcon, Sparkles, Loader2, X, RefreshCw, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, fileToDataUrl } from "@/lib/utils";
import { imageApi } from "@/services/api";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";

const PRESETS = [
  "Analyse this image in complete detail.",
  "Extract all visible text (OCR).",
  "Describe the key objects and their relationships.",
  "Identify any charts, graphs, or diagrams and explain them.",
  "What are the main colors, composition, and visual style?",
];

export default function ImageAnalyzer() {
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [prompt,      setPrompt]      = useState(PRESETS[0]);
  const [analysis,    setAnalysis]    = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    setImageFile(files[0]);
    setImageUrl(await fileToDataUrl(files[0]));
    setAnalysis(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1, maxSize: 20 * 1024 * 1024,
  });

  const handleAnalyse = async () => {
    if (!imageFile) return;
    setIsAnalysing(true);
    setAnalysis(null);
    try {
      const res = await imageApi.analyze(imageFile, prompt);
      setAnalysis(res.analysis);
    } catch (err) {
      toast.error(`Analysis failed: ${(err as Error).message}`);
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleCopy = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => { setImageFile(null); setImageUrl(null); setAnalysis(null); };

  const { onAnimationStart: _oas, ...dropRootProps } = getRootProps();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 h-full overflow-hidden">

      <div className="flex flex-col gap-4 overflow-y-auto">

        <AnimatePresence mode="wait">
          {!imageUrl ? (
            <motion.div
              key="drop"
              {...dropRootProps}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "flex-1 min-h-[240px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 p-8 text-center relative overflow-hidden",
                isDragActive
                  ? "border-nova-500 bg-nova-950/25"
                  : "border-ink-800 hover:border-nova-700/40 hover:bg-ink-900/20"
              )}
            >
              <input {...getInputProps()} />
              <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />
              <div className="w-14 h-14 rounded-2xl bg-ink-800/80 border border-ink-700/50 flex items-center justify-center relative z-10">
                <ImageIcon size={24} className="text-ink-500" />
              </div>
              <div className="relative z-10">
                <p className="text-ink-200 font-display font-semibold">Drop an image</p>
                <p className="text-ink-600 text-xs mt-1">PNG · JPG · WEBP &mdash; up to 20 MB</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1    }}
              className="relative rounded-2xl overflow-hidden border border-ink-800/60 group bg-ink-950 min-h-[240px] flex items-center justify-center"
            >
              <img src={imageUrl} alt="Preview" className="max-h-[360px] max-w-full object-contain" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                onClick={clear}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ink-900/80 backdrop-blur border border-ink-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-950/80 hover:border-rose-700"
              >
                <X size={13} />
              </button>
              <div className="absolute bottom-3 left-3">
                <Badge variant="nova">{imageFile?.name}</Badge>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <label className="text-xs text-ink-500 font-medium uppercase tracking-wide">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full glass rounded-xl border-ink-800/50 px-4 py-3 text-sm text-ink-200 placeholder:text-ink-700 focus:outline-none focus:border-nova-500/35 resize-none transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-lg border transition-colors",
                  prompt === p
                    ? "bg-nova-900/30 border-nova-700/40 text-nova-300"
                    : "border-ink-800/60 text-ink-600 hover:text-ink-300 hover:border-ink-600"
                )}
              >
                {p.slice(0, 28)}{p.length > 28 ? "…" : ""}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleAnalyse} disabled={!imageFile} loading={isAnalysing} size="lg" className="w-full">
          <Sparkles size={15} />
          {isAnalysing ? "Analysing with Nova Lite…" : "Analyse Image"}
        </Button>
      </div>

      <div className="glass rounded-2xl border border-ink-800/50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-nova-400" />
            <span className="text-sm font-medium text-ink-200">Analysis Result</span>
            {analysis && <Badge variant="success">Complete</Badge>}
          </div>
          {analysis && (
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-200 transition-colors">
                {copied ? <><Check size={11} className="text-emerald-400"/>Copied</> : <><Copy size={11}/>Copy</>}
              </button>
              <button onClick={handleAnalyse} className="text-ink-600 hover:text-ink-300 transition-colors" title="Re-analyse">
                <RefreshCw size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {isAnalysing ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-5 py-16">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-nova-600/15 animate-ping" />
                  <div className="absolute inset-0 rounded-full bg-nova-950/50 flex items-center justify-center">
                    <Loader2 size={22} className="text-nova-400 animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-ink-300 text-sm font-medium">Nova Lite analysing…</p>
                  <p className="text-ink-600 text-xs mt-1">Multimodal processing in progress</p>
                </div>
              </motion.div>
            ) : analysis ? (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="nova-prose text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
                <ImageIcon size={28} className="text-ink-800" />
                <p className="text-ink-600 text-sm">Upload an image and click Analyse</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}