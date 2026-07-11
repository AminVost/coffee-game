import Link from "next/link";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";

function statusTone(status: Tournament["status"]) {
  if (status === "ثبت‌نام باز") return "green" as const;
  if (status === "در حال برگزاری") return "red" as const;
  if (status === "به‌زودی") return "gold" as const;
  return "neutral" as const;
}

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const percentage = Math.min(100, Math.round((tournament.registered / tournament.capacity) * 100));
  return <Link href={`/tournaments/${tournament.slug}`} className="group overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[var(--brand)]/40">
    <div className="relative h-44 overflow-hidden p-5 text-white" style={{ background: tournament.cover }}>
      <div className="absolute inset-0 bg-black/15" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between"><Badge tone={statusTone(tournament.status)} className="border-white/15 bg-black/35 text-white">{tournament.status}</Badge><span className="rounded-xl bg-black/30 px-3 py-1.5 text-xs font-bold backdrop-blur">{tournament.gameTitle}</span></div>
        <div><p className="mb-2 text-xs text-white/70">{tournament.format}</p><h3 className="text-xl font-black">{tournament.title}</h3></div>
      </div>
    </div>
    <div className="p-5">
      <div className="grid gap-3 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--brand)]" />{tournament.date}، {tournament.time}</span>
        <span className="flex items-center gap-2"><MapPin size={16} className="text-[var(--brand)]" />{tournament.venue}</span>
      </div>
      <div className="mt-5 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><Trophy size={17} className="text-amber-500" />{tournament.prize}</span><strong className="text-sm text-[var(--brand)]">{tournament.price === 0 ? "رایگان" : formatToman(tournament.price)}</strong></div>
      <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-[var(--muted)]"><span className="flex items-center gap-1"><Users size={14}/>{tournament.registered} ثبت‌نام</span><span>{tournament.capacity - tournament.registered} ظرفیت باقی‌مانده</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${percentage}%` }} /></div></div>
    </div>
  </Link>;
}
