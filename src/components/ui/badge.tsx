import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "green" | "gold" | "red" | "blue" | "neutral"; className?: string }) {
  const tones = {
    green: "bg-emerald-500/12 text-emerald-500 border-emerald-500/20",
    gold: "bg-amber-500/12 text-amber-500 border-amber-500/20",
    red: "bg-red-500/12 text-red-500 border-red-500/20",
    blue: "bg-sky-500/12 text-sky-500 border-sky-500/20",
    neutral: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]"
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", tones[tone], className)}>{children}</span>;
}
