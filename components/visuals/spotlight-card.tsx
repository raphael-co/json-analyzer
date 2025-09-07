"use client";
import { useRef } from "react";
import { cn } from "@/components/visuals/ui";

export default function SpotlightCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty("--mx", `${x}px`);
        el.style.setProperty("--my", `${y}px`);
      }}
      className={cn(
        "relative rounded-2xl border p-6 shadow-sm transition",
        "before:pointer-events-none before:absolute before:inset-0",
        "before:opacity-0 hover:before:opacity-100",
        "before:[background:radial-gradient(200px_200px_at_var(--mx)_var(--my),rgba(37,99,235,0.15),transparent_60%)]",
        "dark:border-white/10",
        className
      )}
    >
      {children}
    </div>
  );
}
