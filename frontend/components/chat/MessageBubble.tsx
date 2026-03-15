"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { User, Zap, ChevronDown, Copy, Check, Wrench } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { ChatMessage } from "@/types";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copiedId,  setCopiedId]  = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const codeCounter = useRef(0);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ring-1",
        isUser
          ? "bg-nova-950/80 ring-nova-500/30"
          : "bg-gradient-to-br from-nova-600 to-accent-cyan ring-nova-400/30 shadow-nova-sm"
      )}>
        {isUser
          ? <User size={14} className="text-nova-400" />
          : <Zap  size={14} className="text-white" strokeWidth={2.5} />}
      </div>

      <div className={cn("flex flex-col gap-1.5 max-w-[80%] min-w-0", isUser && "items-end")}>

        {message.imageUrl && (
          <motion.img
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1    }}
            src={message.imageUrl}
            alt="Attached"
            className="max-w-[260px] rounded-xl border border-ink-700 object-cover shadow-lg"
          />
        )}

        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed break-words",
          isUser
            ? "bg-nova-600/18 border border-nova-500/20 text-ink-100 rounded-tr-sm"
            : "glass border-ink-800/50 text-ink-200 rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={cn("nova-prose", message.isStreaming && !message.content && "typing-cursor")}>
              {message.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match  = /language-(\w+)/.exec(className || "");
                      const code   = String(children).replace(/\n$/, "");
                      const codeId = `c-${message.id}-${codeCounter.current++}`;
                      if (!match) {
                        return <code className={cn("font-mono", className)} {...props}>{children}</code>;
                      }
                      return (
                        <div className="relative my-3 rounded-xl overflow-hidden border border-ink-800">
                          <div className="flex items-center justify-between px-4 py-2 bg-ink-900 border-b border-ink-800">
                            <span className="text-[11px] text-ink-500 font-mono uppercase">{match[1]}</span>
                            <button
                              onClick={() => copyCode(code, codeId)}
                              className="flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-ink-200 transition-colors"
                            >
                              {copiedId === codeId
                                ? <><Check size={10} className="text-emerald-400"/>Copied</>
                                : <><Copy  size={10}/>Copy</>}
                            </button>
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin:0, borderRadius:0, background:"#0a0b10", fontSize:"12.5px", padding:"14px 16px" }}
                          >{code}</SyntaxHighlighter>
                        </div>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <span className="typing-cursor" />
              )}
            </div>
          )}
        </div>

        {message.steps && message.steps.length > 0 && (
          <div className="w-full glass rounded-xl border-ink-800/50 overflow-hidden">
            <button
              onClick={() => setStepsOpen(!stepsOpen)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-ink-500 hover:text-ink-300 transition-colors"
            >
              <Wrench size={11} className="text-nova-500" />
              <span>{message.steps.length} reasoning step{message.steps.length > 1 ? "s" : ""}</span>
              <ChevronDown size={10} className={cn("ml-auto transition-transform duration-200", stepsOpen && "rotate-180")} />
            </button>
            {stepsOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                className="border-t border-ink-800/50 px-3 py-2 space-y-2"
              >
                {message.steps.map((step, i) => (
                  <div key={i} className="text-xs grid grid-cols-[auto_1fr] gap-x-2 items-start">
                    <span className="text-nova-500 font-mono shrink-0">{step.tool}</span>
                    <span className="text-ink-500 font-mono truncate">{step.tool_input.slice(0, 80)}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        <div className={cn("flex items-center gap-2 px-1", isUser && "flex-row-reverse")}>
          <span className="text-[11px] text-ink-700">{formatTime(message.timestamp)}</span>
          {message.model && !isUser && (
            <Badge variant="nova" className="text-[10px] py-px">{message.model}</Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}