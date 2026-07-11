import { Radio, Timer, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LiveMatch } from "@/types";

export function LiveMatchCard({ match }: { match: LiveMatch }) {
  const live = match.status === "LIVE";
  return <Card className="p-5">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-[var(--muted)]">{match.tournament}</p><p className="mt-1 text-sm font-black">{match.round}</p></div><Badge tone={live ? "red" : match.status === "NEXT" ? "gold" : "neutral"}>{live ? <span className="flex items-center gap-1"><Radio size={12}/> زنده</span> : match.status === "NEXT" ? "بازی بعدی" : "پایان‌یافته"}</Badge></div>
    <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><strong>{match.home}</strong><div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-xl font-black tabular-nums">{match.homeScore ?? "-"} <span className="text-[var(--muted)]">:</span> {match.awayScore ?? "-"}</div><strong>{match.away}</strong></div>
    <div className="flex justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><Tv size={14}/>{match.resource}</span><span className="flex items-center gap-1.5"><Timer size={14}/>{match.startsAt}</span></div>
  </Card>;
}
