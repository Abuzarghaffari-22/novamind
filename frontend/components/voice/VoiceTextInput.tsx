"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceTextInputProps {
  onSend:    (text: string) => void;
  disabled?: boolean;
}

export default function VoiceTextInput({ onSend, disabled = false }: VoiceTextInputProps) {
  const [text,     setText]     = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setLastSent(trimmed);
    setText("");
    inputRef.current?.focus();
  }, [text, disabled, onSend]);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const hasText = !!text.trim();

  return (
    <div className="flex flex-col gap-2 w-full">

      <div className="flex items-center gap-3">
        <div className={cn(
          "flex-1 h-px",
          "bg-ink-200/80 dark:bg-ink-800/60",
        )} />
        <span className={cn(
          "text-[11px] flex items-center gap-1.5 select-none",
          "text-ink-400 dark:text-ink-600",
        )}>
          <Mic2 size={10} className="text-ink-300 dark:text-ink-700" />
          or type a message
        </span>
        <div className={cn(
          "flex-1 h-px",
          "bg-ink-200/80 dark:bg-ink-800/60",
        )} />
      </div>

      <div className={cn(
        "flex items-center gap-2 glass rounded-2xl border px-4 py-2.5",
        "transition-all duration-200",
        disabled
          ? [
              "border-ink-200/60    dark:border-ink-800/30",
              "bg-ink-50/60         dark:bg-transparent",
              "opacity-60",
            ]
          : [
              "border-ink-200/90    dark:border-ink-700/50",
              "bg-white/80          dark:bg-transparent",
              "shadow-sm            dark:shadow-none",
              "focus-within:border-nova-400/70  dark:focus-within:border-nova-500/50",
              "focus-within:shadow-[0_0_0_3px_rgba(99,112,241,0.10)]",
              "dark:focus-within:shadow-none",
            ],
      )}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? "Nova is responding…" : "Ask NovaMind anything…"}
          className={cn(
            "flex-1 bg-transparent text-sm",
            "focus:outline-none disabled:cursor-not-allowed",
            "text-ink-900       dark:text-ink-100",
            "placeholder:text-ink-400 dark:placeholder:text-ink-700",
          )}
        />

        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleSend}
          disabled={!hasText || disabled}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl",
            "transition-all duration-200",
            hasText && !disabled
              ? [
                  "bg-nova-600 hover:bg-nova-500 text-white",
                  "shadow-[0_2px_8px_rgba(99,112,241,0.35)]",
                  "dark:shadow-nova",
                ]
              : [
                  "bg-ink-100/80  dark:bg-ink-800/50",
                  "text-ink-300   dark:text-ink-700",
                  "cursor-not-allowed",
                ],
          )}
          aria-label="Send message"
        >
          <Send size={13} />
        </motion.button>
      </div>

      <AnimatePresence>
        {lastSent && (
          <motion.p
            key={lastSent}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y:  0 }}
            exit={{    opacity: 0       }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => { setTimeout(() => setLastSent(null), 3000); }}
            className={cn(
              "text-[11px] text-center truncate px-2",
              "text-ink-400 dark:text-ink-600",
            )}
          >
            Sent: &ldquo;{lastSent}&rdquo;
          </motion.p>
        )}
      </AnimatePresence>

    </div>
  );
}