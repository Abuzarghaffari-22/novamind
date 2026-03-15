import type {
  ChatRequest,
  ChatResponse,
  UploadResponse,
  KBStats,
  Document,
  SearchResult,
  ImageAnalyzeResponse,
  ImageChatResponse,
  VideoAnalyzeResponse,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL   = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.detail ?? err?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const chatApi = {
  send: (body: ChatRequest): Promise<ChatResponse> =>
    request<ChatResponse>("/api/chat/", { method: "POST", body: JSON.stringify(body) }),

  stream: async function* (body: ChatRequest, signal?: AbortSignal): AsyncGenerator<string> {
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") return;
        if (data.startsWith("[ERROR]")) throw new Error(data.slice(8));
        if (data) yield data;
      }
    }
  },

  clearSession: (sessionId: string): Promise<{ cleared: boolean }> =>
    request(`/api/chat/clear/${sessionId}`, { method: "DELETE" }),
};

export const documentsApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: "POST", body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err?.detail ?? err?.error ?? `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  search: (query: string, k = 5): Promise<{ query: string; results: SearchResult[]; count: number }> =>
    request("/api/documents/search", { method: "POST", body: JSON.stringify({ query, k }) }),

  list: (): Promise<{ documents: Document[]; total_chunks: number }> =>
    request("/api/documents/"),

  stats: (): Promise<KBStats> =>
    request("/api/documents/stats"),
};

export const imageApi = {
  analyze: async (file: File, prompt?: string): Promise<ImageAnalyzeResponse> => {
    const form = new FormData();
    form.append("file", file);
    if (prompt) form.append("prompt", prompt);
    const res = await fetch(`${BASE_URL}/api/image/analyze`, {
      method: "POST", body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err?.detail ?? err?.error ?? `Analysis failed: ${res.status}`);
    }
    return res.json();
  },

  chat: (body: {
    session_id: string; message: string;
    image_b64: string; image_format: string;
  }): Promise<ImageChatResponse> =>
    request<ImageChatResponse>("/api/image/chat", {
      method: "POST", body: JSON.stringify(body),
    }),
};

export const videoApi = {
  analyze: async (file: File, prompt?: string): Promise<VideoAnalyzeResponse> => {
    const form = new FormData();
    form.append("file", file);
    if (prompt) form.append("prompt", prompt);
    const res = await fetch(`${BASE_URL}/api/video/analyze`, {
      method: "POST", body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err?.detail ?? err?.error ?? `Analysis failed: ${res.status}`);
    }
    return res.json();
  },

  formats: (): Promise<{ formats: string[]; max_size_mb: number; notes: string[] }> =>
    request("/api/video/formats"),
};

export function createVoiceSocket(_sessionId?: string): WebSocket {
  return new WebSocket(`${WS_URL}/api/voice/ws`);
}

export const healthApi = {
  check: (): Promise<{ status: string; version: string }> =>
    request("/health"),
};