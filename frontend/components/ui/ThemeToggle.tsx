"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export default function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const [isDark,  setIsDark]  = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const html = document.documentElement;
    html.classList.add("theme-transition");
    html.classList.remove("dark", "light");
    html.classList.add(next ? "dark" : "light");
    setTimeout(() => html.classList.remove("theme-transition"), 300);
    try { localStorage.setItem("nova-theme", next ? "dark" : "light"); } catch {}
  };

  if (!mounted || isDark === null) {
    return (
      <div
        className={cn(
          "rounded-xl border border-ink-700/40",
          size === "sm" ? "w-8 h-8" : "w-10 h-10",
          className,
        )}
        aria-hidden
      />
    );
  }

  const isSmall = size === "sm";

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.88, rotate: 10 }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative flex items-center justify-center rounded-xl overflow-hidden",
        "border transition-colors duration-250",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-nova-500 focus-visible:ring-offset-2",
        isDark ? [
          "border-ink-700/60 text-ink-400",
          "hover:border-nova-600/50 hover:text-nova-300 hover:bg-nova-950/20",
        ] : [
          "border-amber-300 text-amber-600",
          "hover:bg-amber-100 hover:border-amber-400",
        ],
        isSmall ? "w-8  h-8" : "w-10 h-10",
        className,
      )}
    >
      <motion.span
        className="absolute inset-0 rounded-xl"
        animate={{
          background: isDark
            ? "rgba(99,112,241,0.07)"
            : "rgba(251,191,36,0.15)",
        }}
        transition={{ duration: 0.3 }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -30, opacity: 0, scale: 0.65 }}
            animate={{ rotate:   0, opacity: 1, scale: 1    }}
            exit={{    rotate:  30, opacity: 0, scale: 0.65 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10"
          >
            <Moon size={isSmall ? 14 : 16} className="text-nova-300" strokeWidth={2} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate:  30, opacity: 0, scale: 0.65 }}
            animate={{ rotate:   0, opacity: 1, scale: 1    }}
            exit={{    rotate: -30, opacity: 0, scale: 0.65 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10"
          >
            <Sun size={isSmall ? 14 : 16} className="text-amber-500" strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}