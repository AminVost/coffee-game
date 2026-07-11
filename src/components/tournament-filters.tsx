"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import type { Tournament } from "@/types";

type Filter = "all" | "fc26" | "backgammon" | "open";

export function TournamentFilters({ items }: { items: Tournament[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "all"
        || (filter === "open" && item.status === "ثبت‌نام باز")
        || item.game === filter;
      const matchesQuery = !needle || `${item.title} ${item.gameTitle} ${item.format} ${item.venue}`.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, items, query]);

  const buttons: Array<[Filter, string]> = [["all","همه"],["fc26","FC 26"],["backgammon","تخته‌نرد"],["open","ثبت‌نام باز"]];

  return <>
    <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">{buttons.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-bold transition ${filter === value ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand)]"}`}>{label}</button>)}</div>
      <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 lg:max-w-xs"><Search size={16} className="text-[var(--muted)]"/><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="جستجوی مسابقه..." value={query} onChange={(event) => setQuery(event.target.value)}/></label>
    </div>
    <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <TournamentCard key={item.id} tournament={item}/>)}</div>
    {!filtered.length && <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">مسابقه‌ای مطابق فیلتر انتخاب‌شده پیدا نشد.</div>}
  </>;
}
