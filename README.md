# NovaMind Frontend

**Next.js 15 · TypeScript · motion · Tailwind CSS**

Enterprise-grade multimodal AI frontend for the NovaMind Amazon Nova competition project.

---

## Stack

| Layer       | Technology                     |
|-------------|--------------------------------|
| Framework   | Next.js 15 (App Router)        |
| Language    | TypeScript 5.7 (strict)        |
| Styling     | Tailwind CSS 3.4               |
| Animation   | motion 11                      |
| State       | Zustand 5 + React hooks        |
| Markdown    | react-markdown + remark-gfm    |
| Syntax HL   | react-syntax-highlighter       |
| Uploads     | react-dropzone                 |
| Toasts      | react-hot-toast                |
| Fonts       | Syne (display) + DM Sans (body)|

---

## Quick Start
```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL to your backend URL

npm install
npm run dev
# → http://localhost:3000
```

## Production Build
```bash
npm run build
npm run type-check   # TypeScript check
npm start
```

---

## Features

### Chat
- Streaming SSE responses with live token display
- Markdown rendering with syntax-highlighted code blocks
- RAG toggle (searches FAISS knowledge base)
- Agent mode (LangChain ReAct with tool use)
- Image attachment (multimodal messages)
- Agent step inspector (collapsible)
- Session management (clear / new session)

### Voice
- WebSocket bidirectional audio with Nova Sonic
- Real-time audio level visualisation
- Animated orb responds to voice amplitude
- Full conversation transcript panel
- Hold-to-speak interaction model

### Documents
- Drag-and-drop upload (PDF, TXT, MD, PNG, JPG, WEBP)
- Real-time ingestion progress
- Semantic search across FAISS index
- Knowledge base statistics (chunks, sources, types)

### Vision
- Image drag-and-drop or file browser
- Prompt presets (OCR, description, diagram analysis, etc.)
- Full markdown analysis output
- Copy-to-clipboard

### Video
- Video drag-and-drop or file browser (MP4, MOV, AVI, MKV, WEBM, WMV, FLV)
- Analysis mode presets (full analysis, scene summary, activity report, etc.)
- Nova Pro powered frame analysis with Nova Lite fallback
- Full markdown analysis output

---

## Project Structure
```
frontend/
├── app/
│   ├── layout.tsx          ← Root layout + SEO metadata
│   ├── page.tsx            ← Home route
│   ├── globals.css         ← Design tokens + base styles
│   ├── error.tsx           ← Global error boundary
│   ├── loading.tsx         ← Global loading screen
│   ├── not-found.tsx       ← 404 page
│   ├── sitemap.ts          ← Dynamic sitemap
│   └── robots.ts           ← robots.txt
├── components/
│   ├── NovaMindApp.tsx     ← Root app shell (all tabs)
│   ├── layout/
│   │   └── Sidebar.tsx     ← Collapsible animated nav
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   └── ChatInput.tsx
│   ├── voice/
│   │   ├── VoiceOrb.tsx
│   │   └── VoiceTextInput.tsx
│   ├── documents/
│   │   └── DocumentUpload.tsx
│   ├── image/
│   │   └── ImageAnalyzer.tsx
│   ├── video/
│   │   └── VideoAnalyzer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       ├── GlassCard.tsx
│       ├── StatCard.tsx
│       ├── ThemeToggle.tsx
│       └── Spinner.tsx
├── hooks/
│   ├── useChat.ts          ← Chat state + streaming
│   ├── useVoice.ts         ← WebSocket voice + Web Audio
│   └── useDocuments.ts     ← KB state + search
├── services/
│   └── api.ts              ← Typed API client (all endpoints)
├── types/
│   └── index.ts            ← All shared TypeScript types
└── lib/
    └── utils.ts            ← cn(), formatBytes(), etc.
```

---

## SEO

- Full `metadata` export on every page (title, description, OG, Twitter)
- `viewport` export for mobile optimisation
- Dynamic `sitemap.ts` and `robots.ts`
- `next.config.ts` security headers
- Semantic HTML + accessible focus states

---

## Environment Variables

| Variable                    | Default                    | Description            |
|-----------------------------|----------------------------|------------------------|
| `NEXT_PUBLIC_API_URL`       | `http://localhost:8000`    | Backend FastAPI URL    |
| `NEXT_PUBLIC_WS_URL`        | `ws://localhost:8000`      | WebSocket base URL     |
| `NEXT_PUBLIC_SITE_URL`      | `https://novamind.ai`      | For sitemap/robots     |