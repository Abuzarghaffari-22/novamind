"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label:  string;
  value:  string | number;
  icon?:  React.ReactNode;
  delta?: string;
  color?: "nova" | "cyan" | "amber" | "emerald" | "violet";
  delay?: number;
}

const COLORS = {
  nova:    { text: "text-nova-400",    bg: "bg-nova-900/30",    border: "border-nova-700/30"    },
  cyan:    { text: "text-cyan-400",    bg: "bg-cyan-900/30",    border: "border-cyan-700/30"    },
  amber:   { text: "text-amber-400",   bg: "bg-amber-900/30",   border: "border-amber-700/30"   },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/30" },
  violet:  { text: "text-violet-400",  bg: "bg-violet-900/30",  border: "border-violet-700/30"  },
};

export default function StatCard({ label, value, icon, delta, color = "nova", delay = 0 }: StatCardProps) {
  const c = COLORS[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl border border-ink-800/60 p-5 space-y-3"
    >
      {icon && (
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", c.bg, c.border)}>
          <span className={c.text}>{icon}</span>
        </div>
      )}
      <div>
        <p className="text-2xl font-display font-bold text-ink-50">{value}</p>
        <p className="text-xs text-ink-500 mt-0.5">{label}</p>
      </div>
      {delta && <p className={cn("text-xs font-medium", c.text)}>{delta}</p>}
    </motion.div>
  );
}