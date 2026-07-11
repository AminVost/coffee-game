"use client";

import { useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import { Alert } from "@/components/ui/alert";
import { SelectField } from "@/components/ui/select";
import type { RankingRow } from "@/types";

const periods = [
  { value: "all_time", label: "تمام دوران" },
  { value: "monthly", label: "ماهانه" },
  { value: "seasonal", label: "فصلی" },
  { value: "yearly", label: "سالانه" }
];

export function RankingsSection({
  game,
  title,
  initialRows
}: {
  game: "fc26" | "backgammon";
  title: string;
  initialRows: RankingRow[];
}) {
  const [period, setPeriod] = useState("all_time");
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function changePeriod(nextPeriod: string) {
    setPeriod(nextPeriod);
    setError("");

    if (nextPeriod === "all_time") {
      setRows(initialRows);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/rankings?game=${game}&period=${nextPeriod}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "دریافت رنکینگ ناموفق بود.");
      setRows(payload.rows || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "دریافت رنکینگ ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        <SelectField value={period} onValueChange={(value) => void changePeriod(value)} options={periods} className="w-48" ariaLabel={`بازه رنکینگ ${title}`} />
      </div>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {loading ? (
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">در حال دریافت رنکینگ...</div>
      ) : rows.length ? (
        <RankingTable rows={rows} />
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">برای این بازه هنوز رنکینگی ثبت نشده است.</div>
      )}
    </section>
  );
}
