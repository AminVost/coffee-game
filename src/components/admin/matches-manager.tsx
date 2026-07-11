/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Edit3, Radio, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MatchItem = {
  id: string;
  tournament: string;
  round: string;
  resource: string;
  status: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};

export function MatchesManager() {
  const [items, setItems] = useState<MatchItem[]>([]);
  const [editing, setEditing] = useState<MatchItem | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [status, setStatus] = useState<"READY" | "LIVE" | "COMPLETED">("LIVE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/matches", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت بازی‌ها انجام نشد.");
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  function openEditor(item: MatchItem) {
    setEditing(item);
    setHomeScore(item.homeScore ?? 0);
    setAwayScore(item.awayScore ?? 0);
    setStatus(["READY","LIVE","COMPLETED"].includes(item.status) ? item.status as typeof status : "READY");
    setError("");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const response = await fetch(`/api/admin/matches/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeScore, awayScore, status })
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setError(payload.message || "ثبت نتیجه انجام نشد.");
    setItems((current) => current.map((item) => item.id === editing.id ? { ...item, homeScore, awayScore, status } : item));
    setEditing(null);
  }

  return <>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <div className="mt-7 grid gap-4 xl:grid-cols-2">
      {items.map((match) => <Card key={match.id} className="p-5">
        <div className="flex justify-between"><div><p className="text-xs text-[var(--muted)]">{match.tournament}</p><strong className="mt-1 block">{match.round}</strong></div>{match.status === "LIVE" && <span className="flex items-center gap-1 text-xs font-bold text-red-500"><Radio size={14}/>زنده</span>}</div>
        <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><strong>{match.home}</strong><div className="rounded-2xl bg-[var(--surface-2)] px-5 py-3 text-xl font-black">{match.homeScore ?? 0} : {match.awayScore ?? 0}</div><strong>{match.away}</strong></div>
        <div className="flex justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]"><span>{match.resource}</span><button onClick={() => openEditor(match)} className="flex cursor-pointer items-center gap-1 font-bold text-[var(--brand)]"><Edit3 size={14}/>ویرایش نتیجه</button></div>
      </Card>)}
      {!loading && !items.length && <p className="col-span-full p-10 text-center text-[var(--muted)]">بازی قابل مدیریت وجود ندارد.</p>}
      {loading && <p className="col-span-full p-10 text-center text-[var(--muted)]">در حال دریافت...</p>}
    </div>
    {editing && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">ویرایش نتیجه</h2><p className="mt-1 text-xs text-[var(--muted)]">{editing.home} مقابل {editing.away}</p></div><button onClick={() => setEditing(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)]"><X size={18}/></button></div>
        <div className="mt-6 grid grid-cols-2 gap-4"><label className="field-label">امتیاز {editing.home}<input className="field" type="number" min="0" value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value))}/></label><label className="field-label">امتیاز {editing.away}<input className="field" type="number" min="0" value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value))}/></label></div>
        <label className="field-label mt-4">وضعیت<select className="field" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="READY">آماده</option><option value="LIVE">زنده</option><option value="COMPLETED">پایان‌یافته</option></select></label>
        <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setEditing(null)}>انصراف</Button><Button onClick={save} disabled={saving}><Save size={16}/>{saving ? "در حال ذخیره" : "ذخیره نتیجه"}</Button></div>
      </Card>
    </div>}
  </>;
}
