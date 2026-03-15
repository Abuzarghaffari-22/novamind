"use client";
import { cn } from "@/lib/utils";

interface SpinnerProps { size?: "sm" | "md" | "lg"; className?: string; }

export default function Spinner({ size = "md", className }: SpinnerProps) {
  const sizes = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-[3px]" };
  return (
    <span
      className={cn(
        "inline-block rounded-full border-white/20 border-t-nova-500 animate-spin",
        sizes[size], className,
      )}
    />
  );
}
