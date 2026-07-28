/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Edit3, Radio, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type MatchItem = {
  id: string;
  tournament: string;
  round: string;
  resourceId: string | null;
  resource: string;
  status: string;
  scheduledAt: string | null;
  durationMin: number | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  refereeUserId: string | null;
  referee: string | null;
  notes: string;
};

type Option = { id: string; title: string };

const statusOptions = [
  { value: "READY", label: "آماده" },
  { value: "LIVE", label: "زنده" },
  { value: "COMPLETED", label: "پایان‌یافته" },
  { value: "POSTPONED", label: "به تعویق افتاده" }
];

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function MatchesManager() {
  const [items, setItems] = useState<MatchItem[]>([]);
  const [resources, setResources] = useState<Option[]>([]);
  const [referees, setReferees] = useState<Option[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [editing, setEditing] = useState<MatchItem | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [status, setStatus] = useState<"READY" | "LIVE" | "COMPLETED" | "POSTPONED">("LIVE");
  const [resourceId, setResourceId] = useState("none");
  const [refereeUserId, setRefereeUserId] = useState("none");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/matches", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت بازی‌ها انجام نشد.");
    setItems(payload.items || []);
    setResources(payload.resources || []);
    setReferees(payload.referees || []);
    setCanManageAll(Boolean(payload.canManageAll));
  }

  useEffect(() => { void load(); }, []);

  function openEditor(item: MatchItem) {
    setEditing(item);
    setHomeScore(item.homeScore ?? 0);
    setAwayScore(item.awayScore ?? 0);
    setStatus(statusOptions.some((option) => option.value === item.status) ? item.status as typeof status : "READY");
    setResourceId(item.resourceId || "none");
    setRefereeUserId(item.refereeUserId || "none");
    setScheduledAt(toLocalInput(item.scheduledAt));
    setDurationMin(item.durationMin || 30);
    setNotes(item.notes || "");
    setError(""); setMessage("");
  }

  async function save() {
    if (!editing) return;
    setSaving(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/matches/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeScore,
        awayScore,
        status,
        notes: notes || null,
        resourceId: canManageAll && resourceId !== "none" ? Number(resourceId) : null,
        refereeUserId: canManageAll && refereeUserId !== "none" ? Number(refereeUserId) : null,
        scheduledAt: canManageAll && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        durationMin: canManageAll ? durationMin : undefined
      })
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setError(payload.message || "ذخیره بازی انجام نشد.");
    setEditing(null);
    setMessage("اطلاعات بازی ذخیره شد.");
    await load();
  }

  return (
    <>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      {message && <Alert tone="success" className="mt-4">{message}</Alert>}
      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        {items.map((match) => <Card key={match.id} className="p-5">
          <div className="flex justify-between"><div><p className="text-xs text-[var(--muted)]">{match.tournament}</p><strong className="mt-1 block">{match.round}</strong></div>{match.status === "LIVE" && <span className="flex items-center gap-1 text-xs font-bold text-red-500"><Radio size={14} />زنده</span>}</div>
          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><strong>{match.home}</strong><div className="rounded-2xl bg-[var(--surface-2)] px-5 py-3 text-xl font-black">{match.homeScore ?? 0} : {match.awayScore ?? 0}</div><strong>{match.away}</strong></div>
          <div className="grid gap-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] sm:grid-cols-2"><span>{match.resource}</span><span>{match.referee ? `داور: ${match.referee}` : "بدون داور"}</span>{match.scheduledAt && <span className="flex items-center gap-1"><CalendarClock size={13}/>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(match.scheduledAt))}</span>}<Button type="button" onClick={() => openEditor(match)} variant="ghost" size="sm" className="justify-self-end"><Edit3 size={14} />ویرایش بازی</Button></div>
        </Card>)}
        {!loading && !items.length && <p className="col-span-full p-10 text-center text-[var(--muted)]">بازی قابل مدیریت وجود ندارد.</p>}
        {loading && <p className="col-span-full p-10 text-center text-[var(--muted)]">در حال دریافت...</p>}
      </div>
      {editing && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/60 p-4">
        <Card className="w-full max-w-2xl p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">ویرایش بازی</h2><p className="mt-1 text-xs text-[var(--muted)]">{editing.home} مقابل {editing.away}</p></div><Button type="button" onClick={() => setEditing(null)} variant="secondary" size="iconSm"><X size={18}/></Button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Label>امتیاز {editing.home}<Input type="number" min="0" max="999" value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value))}/></Label>
            <Label>امتیاز {editing.away}<Input type="number" min="0" max="999" value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value))}/></Label>
            <Label>وضعیت<SelectField value={status} onValueChange={(value) => setStatus(value as typeof status)} options={statusOptions}/></Label>
            {canManageAll && <Label>مدت بازی (دقیقه)<Input type="number" min="5" max="240" value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))}/></Label>}
            {canManageAll && <Label>زمان بازی<PersianDatePicker mode="datetime" value={scheduledAt} onChange={setScheduledAt} /></Label>}
            {canManageAll && <Label>منبع<SelectField value={resourceId} onValueChange={setResourceId} options={[{ value: "none", label: "بدون تخصیص" }, ...resources.map((item) => ({ value: item.id, label: item.title }))]}/></Label>}
            {canManageAll && <Label>داور<SelectField value={refereeUserId} onValueChange={setRefereeUserId} options={[{ value: "none", label: "بدون داور" }, ...referees.map((item) => ({ value: item.id, label: item.title }))]}/></Label>}
            <Label className="sm:col-span-2">یادداشت<Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24"/></Label>
          </div>
          {error && <Alert tone="error" className="mt-4">{error}</Alert>}
          <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>انصراف</Button><Button type="button" onClick={save} loading={saving}><Save size={16}/>ذخیره</Button></div>
        </Card>
      </div>}
    </>
  );
}
