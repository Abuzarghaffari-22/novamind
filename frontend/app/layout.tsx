import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default:  "NovaMind — Amazon Nova AI Assistant",
    template: "%s | NovaMind",
  },
  description:
    "Enterprise-grade multimodal AI assistant powered by Amazon Nova. Chat, analyse images, search documents, and have real-time voice conversations.",
  keywords: ["Amazon Nova", "AI assistant", "multimodal AI", "voice AI", "RAG", "document search", "AWS Bedrock", "NovaMind"],
  authors:  [{ name: "NovaMind" }],
  creator:  "NovaMind",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website", locale: "en_US",
    title: "NovaMind — Amazon Nova AI Assistant",
    description: "Enterprise multimodal AI — chat, vision, voice, and document intelligence.",
    siteName: "NovaMind",
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaMind — Amazon Nova AI Assistant",
    description: "Enterprise multimodal AI — chat, vision, voice, and document intelligence.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0e14",
};

/*
 * Runs synchronously before first paint so the correct theme class is on
 * <html> from frame 1, preventing a flash of the wrong theme on load.
 */
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem("nova-theme");
    var theme = (t === "light" || t === "dark") ? t : "dark";
    document.documentElement.classList.remove("dark","light");
    document.documentElement.classList.add(theme);
  } catch(e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Default "dark" class; the FOUC script below overwrites it before paint
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* FOUC prevention — must be synchronous (no defer/async) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="noise-overlay antialiased" suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:   "rgb(var(--ink-900))",
              color:        "rgb(var(--ink-100))",
              border:       "1px solid var(--glass-border)",
              borderRadius: "12px",
              fontSize:     "14px",
              fontFamily:   "var(--font-body)",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#0d0e14" } },
            error:   { iconTheme: { primary: "#f43f5e", secondary: "#0d0e14" } },
          }}
        />
      </body>
    </html>
  );
}