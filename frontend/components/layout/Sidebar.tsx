"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Mic, FileText, Image, Film, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveTab } from "@/types";

interface SidebarProps {
  activeTab:   ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  collapsed:   boolean;
  onToggle:    () => void;
}

const NAV_ITEMS: {
  id:       ActiveTab;
  icon:     React.ElementType;
  label:    string;
  desc:     string;
  accent:   string;
  activeBg: string;
}[] = [
  {
    id: "chat", icon: MessageSquare, label: "Chat", desc: "AI conversation",
    accent:   "text-nova-400",
    activeBg: "dark:bg-nova-600/10   bg-nova-50   dark:border-nova-500/20  border-nova-200/80",
  },
  {
    id: "voice", icon: Mic, label: "Voice", desc: "Nova Sonic",
    accent:   "text-cyan-400",
    activeBg: "dark:bg-cyan-600/10   bg-cyan-50   dark:border-cyan-500/20  border-cyan-200/80",
  },
  {
    id: "documents", icon: FileText, label: "Documents", desc: "Knowledge base",
    accent:   "text-amber-400",
    activeBg: "dark:bg-amber-600/10  bg-amber-50  dark:border-amber-500/20 border-amber-200/80",
  },
  {
    id: "image", icon: Image, label: "Vision", desc: "Image analysis",
    accent:   "text-violet-400",
    activeBg: "dark:bg-violet-600/10 bg-violet-50 dark:border-violet-500/20 border-violet-200/80",
  },
  {
    id: "video", icon: Film, label: "Video", desc: "Nova Pro · video AI",
    accent:   "text-rose-400",
    activeBg: "dark:bg-rose-600/10   bg-rose-50   dark:border-rose-500/20  border-rose-200/80",
  },
];

const ACTIVE_BAR: Record<ActiveTab, string> = {
  chat:      "bg-nova-500",
  voice:     "bg-cyan-500",
  documents: "bg-amber-500",
  image:     "bg-violet-500",
  video:     "bg-rose-500",
};

export default function Sidebar({ activeTab, onTabChange, collapsed, onToggle }: SidebarProps) {
  return (
    <motion.aside
      data-sidebar
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative flex flex-col h-full shrink-0 overflow-hidden",
        "border-r transition-colors duration-250",
        "dark:glass dark:border-ink-800/50",
        "bg-white border-ink-700/15",
        "shadow-[1px_0_0_0_rgba(30,30,50,0.06)]",
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center gap-3 border-b transition-colors duration-250 shrink-0",
        "dark:border-ink-800/50 border-ink-700/10",
        collapsed ? "justify-center px-4 py-5" : "px-5 py-5",
      )}>
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="relative w-9 h-9 shrink-0 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-nova-500 via-nova-600 to-accent-cyan shadow-nova-md" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-nova-500 to-accent-cyan blur-xl opacity-50" />
          <Zap className="relative z-10 text-white" size={18} strokeWidth={2.5} />
        </motion.div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0   }}
              exit={{    opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="font-display font-bold text-lg leading-none whitespace-nowrap dark:text-ink-50 text-ink-100">
                NovaMind
              </h1>
              <p className="text-[11px] mt-0.5 whitespace-nowrap dark:text-ink-600 text-ink-500">
                Amazon Nova Platform
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className={cn("flex-1 py-4 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        <AnimatePresence>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-3 dark:text-ink-700 text-ink-600"
            >
              Workspace
            </motion.p>
          )}
        </AnimatePresence>

        {NAV_ITEMS.map((item, i) => {
          const active = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0   }}
              transition={{ delay: i * 0.05 + 0.1, duration: 0.35, ease: [0.22,1,0.36,1] }}
              onClick={() => onTabChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-3 py-2.5 rounded-xl text-left transition-all duration-200 group relative border",
                collapsed ? "justify-center px-2" : "px-3",
                active
                  ? [item.activeBg, "dark:text-ink-100 text-ink-100"].join(" ")
                  : [
                      "border-transparent",
                      "dark:text-ink-500 dark:hover:text-ink-200 dark:hover:bg-ink-800/50",
                      "text-ink-400 hover:text-ink-200 hover:bg-ink-900/5 hover:border-ink-700/20",
                    ].join(" "),
              )}
            >
              {/* Active bar */}
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full",
                    ACTIVE_BAR[item.id],
                  )}
                />
              )}

              <item.icon
                size={17}
                className={cn(
                  "shrink-0 transition-colors",
                  active
                    ? item.accent
                    : "dark:text-ink-600 text-ink-500 group-hover:text-ink-300 dark:group-hover:text-ink-300",
                )}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{    opacity: 0, width: 0    }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="text-sm font-medium leading-none whitespace-nowrap">{item.label}</p>
                    <p className="text-[11px] mt-0.5 whitespace-nowrap dark:text-ink-600 text-ink-500">
                      {item.desc}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      {/* ── Model status ──────────────────────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            className="px-3 pb-3"
          >
            <div className={cn(
              "px-3 py-3 rounded-xl space-y-2 transition-colors",
              "dark:bg-ink-900/70 dark:border dark:border-ink-800/40",
              "bg-ink-950/60 border border-ink-800/30",
              "shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.7)]",
            )}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] font-medium dark:text-ink-500 text-ink-400">Models Online</span>
              </div>
              {[
                { name: "Nova Lite",   color: "dark:text-nova-400  text-nova-600"   },
                { name: "Nova Pro",    color: "dark:text-rose-400  text-rose-600"   },
                { name: "Nova Sonic",  color: "dark:text-cyan-400  text-cyan-600"   },
                { name: "Titan Embed", color: "dark:text-amber-400 text-amber-600"  },
              ].map((m) => (
                <div key={m.name} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full dark:bg-ink-600 bg-ink-700/40 shrink-0" />
                  <span className={cn("text-[11px]", m.color)}>{m.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapse toggle ────────────────────────────────────── */}
      <div className={cn("pb-4 flex", collapsed ? "justify-center" : "px-3")}>
        <button
          onClick={onToggle}
          className={cn(
            "w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200",
            "dark:border-ink-700/60 dark:bg-ink-900/50 dark:text-ink-500",
            "dark:hover:text-ink-200 dark:hover:bg-ink-800 dark:hover:border-ink-600",
            "border-ink-700/20 bg-white text-ink-500",
            "hover:text-ink-200 hover:bg-ink-900/5 hover:border-ink-600/40",
            "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </motion.aside>
  );
}