"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { chatApi } from "@/services/api";
import type { ChatMessage, AppSettings } from "@/types";

interface UseChatReturn {
  messages:     ChatMessage[];
  sessionId:    string;
  isLoading:    boolean;
  sendMessage:  (content: string, imageB64?: string, imageFmt?: string, imageUrl?: string) => Promise<void>;
  clearSession: () => void;
  settings:     AppSettings;
  setSettings:  (s: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  useRag:         true,
  useAgent:       false,
  temperature:    0.7,
  streamResponse: true,
};

export function useChat(): UseChatReturn {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [settings,  setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const abortRef = useRef<AbortController | null>(null);

  // Generate sessionId only on the client, after hydration
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  const setSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...partial }));
  }, []);

  const sendMessage = useCallback(async (
    content:  string,
    imageB64?: string,
    imageFmt?: string,
    imageUrl?: string,
  ) => {
    if (!content.trim() && !imageB64) return;

    const userMsg: ChatMessage = {
      id:        uuidv4(),
      role:      "user",
      content,
      timestamp: new Date(),
      imageUrl,
      imageB64,
      imageFmt,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const payload = {
      message:      content,
      session_id:   sessionId,
      use_rag:      settings.useRag,
      use_agent:    settings.useAgent,
      use_history:  true,
      temperature:  settings.temperature,
      image_b64:    imageB64,
      image_format: imageFmt ?? "jpeg",
    };

    if (settings.streamResponse && !settings.useAgent) {
      const assistantId = uuidv4();
      const assistantMsg: ChatMessage = {
        id:          assistantId,
        role:        "assistant",
        content:     "",
        timestamp:   new Date(),
        isStreaming: true,
        model:       "nova-lite",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      abortRef.current = new AbortController();
      let accumulated = "";

      try {
        for await (const chunk of chatApi.stream(payload, abortRef.current.signal)) {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Stream interrupted. Please try again.", isStreaming: false }
                : m
            )
          );
        }
      }
    } else {
      try {
        const res = await chatApi.send(payload);
        const assistantMsg: ChatMessage = {
          id:        uuidv4(),
          role:      "assistant",
          content:   res.answer,
          timestamp: new Date(),
          steps:     res.steps,
          model:     res.model,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errMsg: ChatMessage = {
          id:        uuidv4(),
          role:      "assistant",
          content:   `Error: ${(err as Error).message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    }

    setIsLoading(false);
  }, [sessionId, settings]);

  const clearSession = useCallback(() => {
    abortRef.current?.abort();
    chatApi.clearSession(sessionId).catch(() => null);
    setMessages([]);
    setSessionId(uuidv4());
  }, [sessionId]);

  return { messages, sessionId, isLoading, sendMessage, clearSession, settings, setSettings };
}