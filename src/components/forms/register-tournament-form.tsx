"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/types";

type PlayerInput = { name: string; mobile: string };

export function RegisterTournamentForm({ tournament }: { tournament: Tournament }) {
  const teamSize = useMemo(() => {
    const match = tournament.participantMode.match(/تیمی\s+(\d+)/);
    return match ? Number(match[1]) : 0;
  }, [tournament.participantMode]);
  const isTeam = teamSize > 0;
  const [players, setPlayers] = useState<PlayerInput[]>(Array.from({ length: isTeam ? teamSize : 1 }, () => ({ name: "", mobile: "" })));
  const [teamTitle, setTeamTitle] = useState("");
  const [payment, setPayment] = useState<"online" | "cash" | "receipt">("online");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [result, setResult] = useState<{ status: string; trackingCode: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(index: number, key: keyof PlayerInput, value: string) {
    setPlayers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const normalizedMobiles = players.map((player) => player.mobile.trim());
    if (new Set(normalizedMobiles).size !== normalizedMobiles.length) {
      setError("هر شماره موبایل را فقط یک‌بار وارد کنید.");
      return;
    }
    if (payment === "receipt" && !receipt) {
      setError("برای روش پرداخت فیش، انتخاب فایل الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament.id, players, payment, teamTitle: isTeam ? teamTitle : undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "ثبت‌نام انجام نشد.");

      if (payment === "receipt" && receipt && payload.paymentId) {
        const form = new FormData();
        form.set("paymentId", payload.paymentId);
        form.set("file", receipt);
        if (payload.receiptToken) form.set("receiptToken", payload.receiptToken);
        const uploadResponse = await fetch("/api/payments/receipts", { method: "POST", body: form });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadPayload.message || "ثبت‌نام انجام شد اما آپلود فیش ناموفق بود.");
      }

      setResult({ status: payload.status, trackingCode: payload.trackingCode });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ثبت‌نام انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  if (result) return <div className="rounded-[1.75rem] border border-emerald-500/25 bg-emerald-500/10 p-7 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={48}/><h3 className="mt-4 text-xl font-black">{result.status === "WAITLISTED" ? "در لیست انتظار ثبت شدید" : "رزرو با موفقیت ثبت شد"}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">کد پیگیری: <strong dir="ltr">{result.trackingCode}</strong></p></div>;

  return <form onSubmit={submit} className="grid gap-5">
    <div><h3 className="font-black">{isTeam ? "اعضای تیم" : "شرکت‌کنندگان"}</h3><p className="mt-1 text-xs text-[var(--muted)]">{isTeam ? `برای این مسابقه باید ${teamSize.toLocaleString("fa-IR")} عضو وارد شود.` : "خریدار می‌تواند برای شماره‌های متفاوت چند سهم رزرو کند."}</p></div>
    {isTeam && <label className="field-label">نام تیم<input className="field" value={teamTitle} onChange={(event) => setTeamTitle(event.target.value)} placeholder="مثلاً تیم توربو" required/></label>}
    {players.map((player, index) => <div key={index} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:grid-cols-[1fr_1fr_auto]"><input className="field" placeholder="نام و نام خانوادگی" value={player.name} onChange={(event) => update(index,"name",event.target.value)} required/><input className="field" placeholder="شماره موبایل" dir="ltr" value={player.mobile} onChange={(event) => update(index,"mobile",event.target.value)} pattern="09[0-9]{9}" required/><button type="button" disabled={isTeam || players.length === 1} onClick={() => setPlayers(players.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-[var(--line)] text-red-500 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={17}/></button></div>)}
    {!isTeam && <Button type="button" variant="secondary" onClick={() => setPlayers([...players,{name:"",mobile:""}])}><Plus size={17}/>افزودن سهم دیگر</Button>}
    <label className="field-label">روش پرداخت<select className="field" value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)}><option value="online">درگاه آزمایشی</option><option value="cash">پرداخت حضوری</option><option value="receipt">آپلود فیش</option></select></label>
    {payment === "receipt" && <label className="field-label">فایل فیش<div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] p-4"><Upload size={18} className="text-[var(--brand)]"/><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] || null)} required/></div><span className="mt-1 text-xs font-normal text-[var(--muted)]">JPG، PNG یا PDF حداکثر ۵ مگابایت</span></label>}
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <Button type="submit" disabled={loading}>{loading ? "در حال ثبت..." : `رزرو ${isTeam ? "تیم" : `${players.length.toLocaleString("fa-IR")} سهم`}`}</Button>
  </form>;
}
