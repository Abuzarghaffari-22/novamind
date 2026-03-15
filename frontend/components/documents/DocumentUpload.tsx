"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { Upload, FileText, Image, CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { documentsApi } from "@/services/api";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";
import type { UploadResponse } from "@/types";

interface UploadedFile {
  key:    string;
  name:   string;
  size:   number;
  status: "uploading" | "success" | "error";
  result?: UploadResponse;
  error?:  string;
}

interface Props { onUploaded?: () => void; }

const ACCEPT = {
  "application/pdf": [".pdf"],
  "text/plain":      [".txt"],
  "text/markdown":   [".md"],
  "image/png":       [".png"],
  "image/jpeg":      [".jpg", ".jpeg"],
  "image/webp":      [".webp"],
};

export default function DocumentUpload({ onUploaded }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      const key   = `${file.name}-${file.size}-${Date.now()}`;
      const entry: UploadedFile = { key, name: file.name, size: file.size, status: "uploading" };
      setFiles((prev) => [entry, ...prev]);
      try {
        const result = await documentsApi.upload(file);
        setFiles((prev) => prev.map((f) => f.key === key ? { ...f, status: "success", result } : f));
        toast.success(`${result.chunks} chunk${result.chunks !== 1 ? "s" : ""} ingested`);
        onUploaded?.();
      } catch (err) {
        const msg = (err as Error).message;
        setFiles((prev) => prev.map((f) => f.key === key ? { ...f, status: "error", error: msg } : f));
        toast.error(msg);
      }
    }
  }, [onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPT, maxSize: 20 * 1024 * 1024, multiple: true,
  });

  const removeFile = (key: string) => setFiles((prev) => prev.filter((f) => f.key !== key));

  const { onAnimationStart: _oas, ...dropRootProps } = getRootProps();

  return (
    <div className="space-y-3">
      <motion.div
        {...dropRootProps}
        whileHover={{ scale: 1.008 }}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 overflow-hidden",
          isDragActive
            ? "border-nova-500 bg-nova-950/30 shadow-nova-md"
            : "border-ink-800 hover:border-nova-700/50 hover:bg-ink-900/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

        <AnimatePresence mode="wait">
          {isDragActive ? (
            <motion.div key="drag" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-nova-600/20 border border-nova-500/30 flex items-center justify-center mx-auto mb-3">
                <Upload size={24} className="text-nova-400" />
              </div>
              <p className="text-nova-300 font-display font-semibold">Drop to upload</p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-ink-800/80 border border-ink-700/60 flex items-center justify-center mx-auto mb-3">
                <Upload size={24} className="text-ink-500" />
              </div>
              <p className="text-ink-200 font-display font-semibold mb-1">Drop files or browse</p>
              <p className="text-ink-600 text-xs">PDF · TXT · MD · PNG · JPG · WEBP &mdash; max 20 MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
        <AnimatePresence initial={false}>
          {files.map((file) => (
            <motion.div
              key={file.key}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
              exit={{    opacity: 0, height: 0, marginBottom: 0    }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl border-ink-800/50 p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-ink-800 border border-ink-700/60 flex items-center justify-center shrink-0">
                  {file.name.match(/\.(png|jpg|jpeg|webp)$/i)
                    ? <Image size={15} className="text-amber-400" />
                    : <FileText size={15} className="text-nova-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-100 font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-ink-600">{formatBytes(file.size)}</span>
                    {file.result && <Badge variant="success">{file.result.chunks} chunks</Badge>}
                    {file.error  && <span className="text-xs text-rose-400 truncate">{file.error}</span>}
                  </div>
                  {file.status === "uploading" && (
                    <div className="mt-2 h-0.5 rounded-full bg-ink-800 overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "92%" }}
                        transition={{ duration: 4, ease: "easeOut" }}
                        className="h-full bg-nova-500 rounded-full"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {file.status === "uploading" && <Loader2 size={15} className="text-nova-400 animate-spin" />}
                  {file.status === "success"   && <CheckCircle2 size={15} className="text-emerald-400" />}
                  {file.status === "error"     && <XCircle size={15} className="text-rose-400" />}
                  {file.status !== "uploading" && (
                    <button onClick={() => removeFile(file.key)} className="text-ink-700 hover:text-ink-400 transition-colors">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}