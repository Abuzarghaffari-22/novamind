export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id:           string;
  role:         MessageRole;
  content:      string;
  timestamp:    Date;
  imageUrl?:    string;
  imageB64?:    string;
  imageFmt?:    string;
  steps?:       AgentStep[];
  model?:       string;
  isStreaming?: boolean;
}

export interface ChatRequest {
  message:       string;
  session_id:    string;
  use_rag?:      boolean;
  use_agent?:    boolean;
  use_history?:  boolean;
  temperature?:  number;
  image_b64?:    string;
  image_format?: string;
}

export interface ChatResponse {
  answer:       string;
  session_id:   string;
  context_used: ContextDoc[];
  steps:        AgentStep[];
  model:        string;
  has_image:    boolean;
}

export interface AgentStep {
  tool:        string;
  tool_input:  string;
  observation: string;
}

export interface ContextDoc {
  doc_id:   string;
  content:  string;
  source:   string;
  doc_type: string;
  score:    number;
  rank:     number;
}

export interface Document {
  source:      string;
  doc_type:    string;
  chunk_count: number;
  created_at:  number;
}

export interface UploadResponse {
  success:  boolean;
  filename: string;
  chunks:   number;
  doc_type: string;
  message:  string;
}

export interface KBStats {
  total_chunks:   number;
  unique_sources: number;
  by_type:        Record<string, number>;
  sources:        string[];
}

export interface SearchResult {
  doc_id:   string;
  content:  string;
  source:   string;
  doc_type: string;
  score:    number;
  rank:     number;
}

export interface ImageAnalyzeResponse {
  filename:     string;
  analysis:     string;
  image_format: string;
  model:        string;
}

export interface ImageChatResponse {
  answer:       string;
  session_id:   string;
  image_format: string;
  model:        string;
}

export interface VideoAnalyzeResponse {
  filename:     string;
  analysis:     string;
  video_format: string;
  file_size_mb: number;
  model:        string;
  prompt_used:  string;
}

export type VoiceEventType =
  | "session_id"
  | "greeting_start"
  | "audio_chunk"
  | "text_chunk"
  | "turn_complete"
  | "error";

export interface VoiceEvent {
  type:        VoiceEventType;
  data?:       string;
  message?:    string;
  session_id?: string;
}

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export interface VoiceTranscript {
  id:        string;
  role:      "user" | "assistant";
  text:      string;
  timestamp: Date;
}

export type ActiveTab = "chat" | "voice" | "documents" | "image" | "video";

export interface AppSettings {
  useRag:         boolean;
  useAgent:       boolean;
  temperature:    number;
  streamResponse: boolean;
}

export type Theme = "dark" | "light";