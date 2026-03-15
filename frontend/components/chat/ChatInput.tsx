"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ImagePlus, X, SlidersHorizontal, Zap, BookOpen, Waves } from "lucide-react";
import { cn, fileToBase64, fileToDataUrl, getFileExtension } from "@/lib/utils";
import Button from "@/components/ui/Button";
import type { AppSettings } from "@/types";

interface Props {
  onSend:     (text: string, imageB64?: string, imageFmt?: string, imageUrl?: string) => void;
  isLoading:  boolean;
  settings:   AppSettings;
  onSettings: (s: Partial<AppSettings>) => void;
  disabled?:  boolean;
}

export default function ChatInput({ onSend, isLoading, settings, onSettings, disabled }: Props) {
  const [text,      setText]      = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl,  setImageUrl]  = useState<string | null>(null);
  const [showOpts,  setShowOpts]  = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setImageFile(file);
    setImageUrl(await fileToDataUrl(file));
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImageUrl(null);
  }, []);

  const handleSend = useCallback(async () => {
    if ((!text.trim() && !imageFile) || isLoading || disabled) return;
    let b64: string | undefined;
    let fmt: string | undefined;
    if (imageFile) {
      b64 = await fileToBase64(imageFile);
      fmt = getFileExtension(imageFile.name) || "jpeg";
    }
    onSend(text.trim(), b64, fmt, imageUrl ?? undefined);
    setText("");
    clearImage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, imageFile, imageUrl, isLoading, disabled, onSend, clearImage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const canSend = (text.trim() || !!imageFile) && !isLoading && !disabled;

  return (
    <div className="space-y-2">

      <AnimatePresence>
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.88, y: 10 }}
            className="relative inline-block"
          >
            <img
              src={imageUrl} alt="Attached"
              className={cn(
                "h-20 w-20 object-cover rounded-xl border shadow-lg",
                "dark:border-ink-700 border-ink-700/30",
              )}
            />
            <button
              onClick={clearImage}
              className={cn(
                "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                "dark:bg-ink-950 dark:border-ink-700 dark:hover:bg-rose-950 dark:hover:border-rose-700",
                "bg-white border-ink-700/30 hover:bg-rose-50 hover:border-rose-300",
                "shadow-sm",
              )}
            >
              <X size={9} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOpts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{    opacity: 0, height: 0    }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border text-xs",
              "dark:bg-ink-900/60 dark:border-ink-800/50 dark:backdrop-blur-sm",
              "bg-white border-ink-700/15",
              "shadow-[0_1px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]",
            )}>
              <Toggle label="RAG Search"  icon={<BookOpen size={11}/>} checked={settings.useRag}         onChange={(v) => onSettings({ useRag: v })}         />
              <Toggle label="Agent Mode"  icon={<Zap size={11}/>}      checked={settings.useAgent}       onChange={(v) => onSettings({ useAgent: v })}       />
              <Toggle label="Streaming"   icon={<Waves size={11}/>}    checked={settings.streamResponse} onChange={(v) => onSettings({ streamResponse: v })} />
              <div className="flex items-center gap-2 ml-auto">
                <span className="dark:text-ink-600 text-ink-500">Temp</span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={settings.temperature}
                  onChange={(e) => onSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-20 h-1 accent-nova-500 cursor-pointer"
                />
                <span className="dark:text-nova-400 text-nova-600 tabular-nums w-5 font-medium">
                  {settings.temperature}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "rounded-2xl border transition-all duration-200",
        "dark:bg-ink-900/50 dark:border-ink-800/60",
        "dark:backdrop-blur-sm",
        "dark:focus-within:border-nova-500/40 dark:focus-within:shadow-[0_0_0_1px_rgba(99,112,241,0.15),0_4px_16px_rgba(99,112,241,0.1)]",
        "bg-white border-ink-700/18",
        "shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.04)]",
        "focus-within:border-nova-500/40 focus-within:shadow-[0_0_0_3px_rgba(99,112,241,0.08),0_2px_12px_rgba(0,0,0,0.08)]",
        disabled && "opacity-50",
      )}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask NovaMind anything… (Shift+Enter for new line)"
          rows={1}
          className={cn(
            "w-full bg-transparent resize-none px-4 pt-3.5 pb-1.5 text-sm",
            "focus:outline-none font-body leading-relaxed min-h-[48px]",
            "dark:text-ink-100 dark:placeholder:text-ink-700",
            "text-ink-100 placeholder:text-ink-500",
          )}
          style={{ maxHeight: "200px" }}
        />

        <div className={cn(
          "flex items-center justify-between px-3 pb-3 pt-1 gap-2",
          "border-t transition-colors",
          "dark:border-ink-800/40",
          "border-ink-700/8",
        )}>
          <div className="flex items-center gap-1">
            <IconBtn title="Attach image" onClick={() => fileRef.current?.click()} active={!!imageFile}>
              <ImagePlus size={15} />
            </IconBtn>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
            />
            <IconBtn title="Options" onClick={() => setShowOpts(!showOpts)} active={showOpts}>
              <SlidersHorizontal size={15} />
            </IconBtn>

            <div className="flex gap-1 ml-1">
              {settings.useRag   && <ModePill label="RAG"   color="nova" />}
              {settings.useAgent && <ModePill label="Agent" color="cyan" />}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] hidden sm:block dark:text-ink-700 text-ink-500">↵ send</span>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              loading={isLoading}
              size="sm"
              className="rounded-xl h-8 px-3"
            >
              <Send size={13} />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, active }: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  active?:  boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-2 rounded-lg transition-all duration-200 text-sm",
        active
          ? [
              "dark:text-nova-400 dark:bg-nova-900/40 dark:border dark:border-nova-700/30",
              "text-nova-600 bg-nova-50 border border-nova-200/80",
            ].join(" ")
          : [
              "dark:text-ink-600 dark:hover:text-ink-300 dark:hover:bg-ink-800/60",
              "text-ink-500 hover:text-ink-300 hover:bg-ink-900/6 border border-transparent hover:border-ink-700/20",
            ].join(" "),
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ label, icon, checked, onChange }: {
  label:    string;
  icon?:    React.ReactNode;
  checked:  boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none",
          "focus-visible:ring-2 focus-visible:ring-nova-500 focus-visible:ring-offset-1",
          checked
            ? "dark:bg-nova-600 bg-nova-500 shadow-[0_0_0_1px_rgba(99,112,241,0.3)]"
            : "dark:bg-ink-700 bg-ink-700/30 border dark:border-transparent border-ink-700/30",
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200",
          checked && "translate-x-4",
        )} />
      </button>
      <span className={cn(
        "flex items-center gap-1 transition-colors",
        checked
          ? "dark:text-ink-300 text-ink-300"
          : "dark:text-ink-500 text-ink-400",
      )}>
        {icon}{label}
      </span>
    </label>
  );
}

function ModePill({ label, color }: { label: string; color: "nova" | "cyan" }) {
  const styles = {
    nova: "dark:bg-nova-900/40 dark:text-nova-400 dark:border-nova-700/30   bg-nova-50 text-nova-600 border-nova-200",
    cyan: "dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700/30   bg-cyan-50 text-cyan-700 border-cyan-200",
  };
  return (
    <span className={cn("text-[10px] border rounded-md px-1.5 py-0.5 font-semibold tracking-wide", styles[color])}>
      {label}
    </span>
  );
}