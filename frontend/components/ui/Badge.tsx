"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "nova" | "success" | "warning" | "danger" | "cyan";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-ink-800 text-ink-300 border-ink-700",
    nova:    "bg-nova-900/50 text-nova-300 border-nova-700/50",
    success: "bg-emerald-900/30 text-emerald-400 border-emerald-700/30",
    warning: "bg-amber-900/30 text-amber-400 border-amber-700/30",
    danger:  "bg-rose-900/30 text-rose-400 border-rose-700/30",
    cyan:    "bg-cyan-900/30 text-cyan-400 border-cyan-700/30",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
      variants[variant], className
    )}>
      {children}
    </span>
  );
}
