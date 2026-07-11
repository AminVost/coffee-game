/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus, Users, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TeamItem = { id: string; publicId: string; title: string; memberCount: number; isCaptain: boolean };

export function TeamsManager() {
  const [items, setItems] = useState<TeamItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/teams", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت تیم‌ها انجام نشد.");
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setError(payload.message || "ساخت تیم انجام نشد.");
    setItems((current) => [payload.item, ...current]);
    setTitle("");
    setOpen(false);
  }

  async function copyCode(team: TeamItem) {
    await navigator.clipboard.writeText(team.publicId);
    setCopied(team.id);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return <>
    <div className="flex justify-end"><Button size="sm" type="button" onClick={() => setOpen(true)}><Plus size={16} />تیم جدید</Button></div>
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    <div className="mt-7 grid gap-4 lg:grid-cols-2">
      {items.map((team) => <Card key={team.id} className="p-6">
        <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand)]/12 text-[var(--brand)]"><Users /></span><div><h2 className="text-lg font-black">{team.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{team.memberCount.toLocaleString("fa-IR")} عضو{team.isCaptain ? " · کاپیتان: شما" : ""}</p></div></div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] p-4"><span className="truncate text-sm">کد دعوت: <strong dir="ltr">{team.publicId}</strong></span><Button type="button" variant="ghost" size="iconSm" onClick={() => copyCode(team)} aria-label="کپی کد دعوت">{copied === team.id ? <Check size={17} /> : <Copy size={17} />}</Button></div>
      </Card>)}
      {!loading && !items.length && <Card className="p-10 text-center text-sm text-[var(--muted)]">هنوز تیمی نساخته‌اید.</Card>}
      {loading && <p className="text-sm text-[var(--muted)]">در حال دریافت تیم‌ها...</p>}
    </div>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black">ساخت تیم جدید</h2><Button type="button" onClick={() => setOpen(false)} variant="secondary" size="iconSm" aria-label="بستن"><X size={18} /></Button></div>
        <form onSubmit={createTeam} className="mt-6 grid gap-5"><Label>نام تیم<Input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={140} required autoFocus /></Label><p className="text-xs leading-6 text-[var(--muted)]">پس از ساخت، شما به‌عنوان کاپیتان ثبت می‌شوید و کد دعوت اختصاصی تیم نمایش داده می‌شود.</p><Button type="submit" loading={saving} loadingText="در حال ساخت">ساخت تیم</Button></form>
      </Card>
    </div>}
  </>;
}
