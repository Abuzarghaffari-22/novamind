"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children:   React.ReactNode;
  className?: string;
  hover?:     boolean;
  glow?:      boolean;
  onClick?:   () => void;
}

export default function GlassCard({ children, className, hover, glow, onClick }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onClick}
      className={cn(
        "glass rounded-2xl border border-ink-800/60",
        hover && "cursor-pointer glass-hover transition-all duration-200",
        glow  && "nova-glow",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}