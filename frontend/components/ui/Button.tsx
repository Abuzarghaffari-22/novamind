"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?:    "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base = [
      "relative inline-flex items-center justify-center font-body font-medium",
      "transition-all duration-200 select-none",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      "focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-nova-500 focus-visible:ring-offset-2",
      "dark:focus-visible:ring-offset-ink-950",
      "focus-visible:ring-offset-white",
    ].join(" ");

    const variants = {
      primary: [
        "dark:bg-nova-600 dark:hover:bg-nova-500 dark:text-white",
        "dark:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_12px_rgba(99,112,241,0.3)]",
        "dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_6px_20px_rgba(99,112,241,0.4)]",
        "bg-nova-600 hover:bg-nova-700 text-white",
        "shadow-[0_1px_3px_rgba(99,112,241,0.4),0_2px_8px_rgba(99,112,241,0.2)]",
        "hover:shadow-[0_2px_6px_rgba(99,112,241,0.45),0_4px_14px_rgba(99,112,241,0.25)]",
        "rounded-xl",
      ].join(" "),

      ghost: [
        "dark:text-ink-400 dark:hover:text-ink-100 dark:hover:bg-ink-800/70",
        "dark:border dark:border-transparent dark:hover:border-ink-700/50",
        "text-ink-300 hover:text-ink-100 hover:bg-ink-900/8",
        "border border-transparent hover:border-ink-700/30",
        "rounded-xl",
      ].join(" "),

      outline: [
        "dark:border dark:border-ink-700/70 dark:text-ink-300 dark:hover:text-ink-50",
        "dark:hover:border-nova-500/50 dark:hover:bg-nova-950/30",
        "dark:bg-ink-900/30",
        "border border-ink-700/40 text-ink-300 hover:text-ink-100",
        "hover:border-nova-500/60 hover:bg-nova-950/5 bg-white/60",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        "rounded-xl",
      ].join(" "),

      danger: [
        "dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400",
        "dark:border dark:border-rose-500/25 dark:hover:border-rose-500/40",
        "bg-rose-50 hover:bg-rose-100 text-rose-600",
        "border border-rose-200 hover:border-rose-300",
        "shadow-[0_1px_2px_rgba(239,68,68,0.1)]",
        "rounded-xl",
      ].join(" "),
    };

    const sizes = {
      sm:   "h-8  px-3   text-sm  gap-1.5",
      md:   "h-10 px-4   text-sm  gap-2",
      lg:   "h-12 px-6   text-base gap-2",
      icon: "h-10 w-10   text-sm",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || loading ? 1 : 0.96 }}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </span>
        )}
        <span className={cn("flex items-center gap-2", loading && "invisible")}>
          {children}
        </span>
      </motion.button>
    );
  }
);
Button.displayName = "Button";
export default Button;