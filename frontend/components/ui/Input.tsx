"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  icon?:    React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-widest dark:text-ink-500 text-ink-400">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 dark:text-ink-600 text-ink-500 pointer-events-none transition-colors group-focus-within:text-nova-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-10 rounded-xl text-sm transition-all duration-200",
            "placeholder:transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            icon ? "pl-9 pr-4" : "px-4",

            // Dark mode
            "dark:bg-ink-900/60 dark:border dark:border-ink-700/60",
            "dark:text-ink-100 dark:placeholder:text-ink-700",
            "dark:hover:border-ink-600/80 dark:hover:bg-ink-900/80",
            "dark:focus:outline-none dark:focus:border-nova-500/60",
            "dark:focus:ring-2 dark:focus:ring-nova-500/15",
            "dark:focus:bg-ink-900",
            "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",

            // Light mode
            "bg-white border border-ink-700/20",
            "text-ink-100 placeholder:text-ink-500",
            "hover:border-ink-600/50",
            "focus:outline-none focus:border-nova-500/70",
            "focus:ring-2 focus:ring-nova-500/12",
            "shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]",
            "focus:shadow-[0_1px_3px_rgba(99,112,241,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]",

            error
              ? [
                  "dark:border-rose-500/50 dark:focus:ring-rose-500/20",
                  "border-rose-400/60 focus:ring-rose-400/15",
                ].join(" ")
              : "",
            className,
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs dark:text-rose-400 text-rose-500 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-current mt-px" />
          {error}
        </p>
      )}
    </div>
  ),
);
Input.displayName = "Input";
export default Input;