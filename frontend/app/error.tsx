"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center text-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0  }}
        className="space-y-5 max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold text-ink-50">Something went wrong</h2>
          <p className="text-ink-500 text-sm mt-2">{error.message}</p>
        </div>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-nova-600 hover:bg-nova-500 text-white text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </motion.div>
    </div>
  );
}