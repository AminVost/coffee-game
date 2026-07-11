"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LiveMatchCard } from "@/components/live-match-card";
import { Button } from "@/components/ui/button";
import type { LiveMatch } from "@/types";

export function LiveBoard({ initialItems }: { initialItems: LiveMatch[] }) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "بروزرسانی انجام نشد.");
      setItems(payload.items || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "بروزرسانی انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return <>
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
        {loading ? "در حال بروزرسانی" : "بروزرسانی"}
      </Button>
    </div>
    {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      {items.map((match) => <LiveMatchCard key={match.id} match={match}/>) }
      {!items.length && <p className="col-span-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">در حال حاضر بازی زنده یا آماده‌ای وجود ندارد.</p>}
    </div>
  </>;
}
