"use client";

import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, PhoneOff, Loader2, Volume2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/types";

interface Props {
  status:         VoiceStatus;
  audioLevel:     number;
  onConnect:      () => void;
  onDisconnect:   () => void;
  onStartListen:  () => void;
  onStopListen:   () => void;
}

type StatusCfg = {
  label:     string;
  sub?:      string;
  icon:      React.ReactNode;
  ring:      string;
  glow:      string;
  bg:        string;
  shadow:    string;
  clickable: boolean;
};

function useStatusConfig(status: VoiceStatus, audioLevel: number): StatusCfg {
  const level = Math.min(audioLevel, 1);

  const configs: Record<VoiceStatus, StatusCfg> = {

    idle: {
      label:     "Click to connect",
      icon:      <Mic size={32} className="text-ink-400 dark:text-ink-500" />,
      ring:      "ring-ink-300/80   dark:ring-ink-700/60",
      glow:      "bg-ink-200/60     dark:bg-ink-800/40",
      bg:        "bg-white/90       dark:bg-ink-900/60",
      shadow:    "shadow-[0_8px_32px_rgba(99,112,241,0.10)] dark:shadow-none",
      clickable: true,
    },

    connecting: {
      label:     "Connecting…",
      icon:      <Loader2 size={32} className="text-amber-500 dark:text-amber-400 animate-spin" />,
      ring:      "ring-amber-400/60  dark:ring-amber-600/40",
      glow:      "bg-amber-100/70    dark:bg-amber-900/30",
      bg:        "bg-amber-50/90     dark:bg-amber-950/40",
      shadow:    "shadow-[0_8px_32px_rgba(245,158,11,0.14)] dark:shadow-none",
      clickable: false,
    },

    ready: {
      label:     "Hold to speak",
      sub:       "Press and hold the orb",
      icon:      <Mic size={32} className="text-emerald-600 dark:text-emerald-300" />,
      ring:      "ring-emerald-500/60  dark:ring-emerald-600/50",
      glow:      "bg-emerald-100/70    dark:bg-emerald-900/25",
      bg:        "bg-white/92          dark:bg-emerald-950/30",
      shadow:    "shadow-[0_8px_40px_rgba(16,185,129,0.18)] dark:shadow-none",
      clickable: true,
    },

    listening: {
      label:     "Listening…",
      sub:       "Release when done",
      icon: (
        <motion.div
          animate={{ scale: [1, 1.12 + level * 0.2, 1] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <Mic size={32} className="text-nova-600 dark:text-nova-300" />
        </motion.div>
      ),
      ring:      "ring-nova-400/80    dark:ring-nova-500/70",
      glow:      "bg-nova-200/70      dark:bg-nova-600/40",
      bg:        "bg-white/92         dark:bg-nova-950/50",
      shadow:    "shadow-[0_8px_48px_rgba(99,112,241,0.28)] dark:shadow-none",
      clickable: true,
    },

    processing: {
      label:     "Processing…",
      icon:      <Loader2 size={32} className="text-cyan-600 dark:text-cyan-400 animate-spin" />,
      ring:      "ring-cyan-400/60    dark:ring-cyan-500/50",
      glow:      "bg-cyan-100/70      dark:bg-cyan-900/30",
      bg:        "bg-cyan-50/90       dark:bg-cyan-950/40",
      shadow:    "shadow-[0_8px_40px_rgba(6,182,212,0.18)] dark:shadow-none",
      clickable: false,
    },

    speaking: {
      label:     "NovaMind speaking",
      sub:       "Nova Sonic response",
      icon: (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Volume2 size={32} className="text-violet-600 dark:text-violet-300" />
        </motion.div>
      ),
      ring:      "ring-violet-400/70   dark:ring-violet-500/60",
      glow:      "bg-violet-100/70     dark:bg-violet-700/35",
      bg:        "bg-white/92          dark:bg-violet-950/40",
      shadow:    "shadow-[0_8px_48px_rgba(139,92,246,0.22)] dark:shadow-none",
      clickable: false,
    },

    error: {
      label:     "Connection error",
      sub:       "Click to retry",
      icon:      <MicOff size={32} className="text-rose-500 dark:text-rose-400" />,
      ring:      "ring-rose-400/70   dark:ring-rose-600/50",
      glow:      "bg-rose-100/70     dark:bg-rose-900/25",
      bg:        "bg-rose-50/90      dark:bg-rose-950/30",
      shadow:    "shadow-[0_8px_32px_rgba(244,63,94,0.16)] dark:shadow-none",
      clickable: true,
    },
  };

  return configs[status];
}


export default function VoiceOrb({
  status, audioLevel,
  onConnect, onDisconnect,
  onStartListen, onStopListen,
}: Props) {
  const cfg         = useStatusConfig(status, audioLevel);
  const isConnected = !["idle", "error", "connecting"].includes(status);
  const level       = Math.min(audioLevel, 1);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!isConnected) {
      onConnect();
    } else if (status === "ready") {
      onStartListen();
    } else if (status === "error") {
      onConnect();
    }
  };

  const handlePointerUp = () => {
    if (status === "listening") onStopListen();
  };

  return (
    <div className="flex flex-col items-center gap-10 select-none">

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0  }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border glass",
          "border-ink-200/80 dark:border-ink-800/50",
          "shadow-sm dark:shadow-none",
        )}
      >
        <Wifi
          size={12}
          className={cn(
            isConnected
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-ink-400    dark:text-ink-600"
          )}
        />
        <span className="text-xs text-ink-600 dark:text-ink-400">
          {isConnected ? "Nova Sonic connected" : "Not connected"}
        </span>
      </motion.div>

      <div className="relative flex items-center justify-center w-56 h-56">

        <AnimatePresence>
          {status === "listening" && [1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.1 + i * 0.28 + level * 0.35, opacity: 0 }}
              transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.28, ease: "easeOut" }}
              className={cn(
                "absolute inset-0 rounded-full pointer-events-none",
                "border border-nova-400/50 dark:border-nova-500/30",
              )}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {status === "speaking" && [1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.18 + i * 0.18, opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
              className={cn(
                "absolute inset-0 rounded-full pointer-events-none",
                "border border-violet-400/40 dark:border-violet-500/25",
              )}
            />
          ))}
        </AnimatePresence>

        <motion.div
          animate={{
            scale:   status === "listening" ? 1 + level * 0.25 : 1,
            opacity: isConnected ? 0.8 : 0.25,
          }}
          transition={{ duration: 0.1 }}
          className={cn(
            "absolute inset-6 rounded-full blur-3xl transition-colors duration-500 pointer-events-none",
            cfg.glow,
          )}
        />

        <motion.div
          whileHover={cfg.clickable ? { scale: 1.04 } : undefined}
          whileTap={cfg.clickable   ? { scale: 0.94 } : undefined}
          animate={{ scale: status === "listening" ? 1 + level * 0.08 : 1 }}
          transition={{ duration: 0.08 }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className={cn(
            "relative z-10 w-40 h-40 rounded-full",
            "flex items-center justify-center",
            "ring-4 transition-all duration-300",
            cfg.ring,
            cfg.bg,
            cfg.shadow,
            "backdrop-blur-xl",
            cfg.clickable ? "cursor-pointer" : "cursor-default",
          )}
        >
          <div className={cn(
            "absolute inset-3 rounded-full opacity-15 dark:opacity-20",
            "transition-all duration-500 pointer-events-none",
            status === "listening"  ? "bg-gradient-to-br from-nova-400    to-nova-700"    :
            status === "speaking"   ? "bg-gradient-to-br from-violet-400  to-violet-700"  :
            status === "ready"      ? "bg-gradient-to-br from-emerald-400 to-emerald-700" :
            status === "processing" ? "bg-gradient-to-br from-cyan-400    to-cyan-700"    :
            "bg-gradient-to-br from-ink-300 to-ink-600 dark:from-ink-500 dark:to-ink-900",
          )} />

          <div className="relative z-10 pointer-events-none">
            {cfg.icon}
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y:  6 }}
          animate={{ opacity: 1, y:  0 }}
          exit={{    opacity: 0, y: -6 }}
          className="text-center pointer-events-none"
        >
          <p className="text-base font-display font-semibold text-ink-900 dark:text-ink-100">
            {cfg.label}
          </p>
          {cfg.sub && (
            <p className="text-sm text-ink-500 dark:text-ink-500 mt-1">
              {cfg.sub}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isConnected && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y:  8 }}
            animate={{ opacity: 1, scale: 1,    y:  0 }}
            exit={{    opacity: 0, scale: 0.85, y:  8 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm",
              "border transition-colors",
              "bg-white/80 border-rose-200/80 text-rose-500",
              "hover:bg-rose-50 hover:border-rose-300",
              "dark:bg-rose-950/40 dark:border-rose-800/40 dark:text-rose-400",
              "dark:hover:bg-rose-900/50 dark:hover:border-rose-700/50",
              "shadow-sm dark:shadow-none",
            )}
          >
            <PhoneOff size={13} />
            End session
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === "ready" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            className={cn(
              "text-xs text-center max-w-[200px]",
              "text-ink-500 dark:text-ink-700",
            )}
          >
            Press and hold the orb while speaking. Release when done.
          </motion.p>
        )}
      </AnimatePresence>

    </div>
  );
}