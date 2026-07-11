"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <span className="h-10 w-10 rounded-xl border border-[var(--line)]" />;
  const dark = resolvedTheme === "dark";
  return <button aria-label="تغییر پوسته" onClick={() => setTheme(dark ? "light" : "dark")} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--brand)]">
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}
