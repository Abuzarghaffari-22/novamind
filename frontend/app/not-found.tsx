import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "404 — Page Not Found" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center text-center px-6">
      <div className="space-y-6">
        <p className="text-8xl font-display font-black text-gradient">404</p>
        <h1 className="text-2xl font-display font-semibold text-ink-100">Page not found</h1>
        <p className="text-ink-500 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-nova-600 hover:bg-nova-500 text-white text-sm font-medium transition-colors shadow-nova-sm"
        >
          ← Back to NovaMind
        </Link>
      </div>
    </div>
  );
}
