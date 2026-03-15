import type { Metadata } from "next";
import NovaMindApp from "@/components/NovaMindApp";

export const metadata: Metadata = {
  title: "NovaMind — Amazon Nova AI Assistant",
  description: "Enterprise multimodal AI — chat, vision, voice, and document intelligence powered by Amazon Nova.",
};

export default function Home() {
  return <NovaMindApp />;
}
