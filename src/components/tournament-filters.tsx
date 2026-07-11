"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const filters: Array<[Filter, string]> = [["all", "همه"], ["fc26", "FC 26"], ["backgammon", "تخته‌نرد"], ["open", "ثبت‌نام باز"]];

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "primary" : "secondary"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
          <Input className="pr-11" placeholder="جستجوی مسابقه..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => <TournamentCard key={item.id} tournament={item} />)}
      </div>
      {!filtered.length && <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">مسابقه‌ای مطابق فیلتر انتخاب‌شده پیدا نشد.</div>}
    </>
  );
}
