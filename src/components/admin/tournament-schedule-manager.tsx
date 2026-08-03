/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, Eye, RefreshCcw, UsersRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";


type Overview = {
  tournament: {
    id: number;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    venueId: string | null;
    venue: string | null;
    game: string;
    resourceType: string;
  };
  defaults: {
    durationMin: number;
    roundBreakMin: number;
    participantRestMin: number;
    startAt: string;
  };
  counts: {
    total: number;
    scheduled: number;
    unscheduled: number;
    completed: number;
  };
  resources: Array<{ id: string; title: string; type: string }>;
  referees: Array<{ id: string; title: string }>;
  matches: Array<{
    id: string;
    matchNumber: number;
    round: string;
    status: string;
    scheduledAt: string | null;
    durationMin: number | null;
    home: string;
    away: string;
  }>;
};

type PlanItem = {
  matchId: string;
  matchNumber: number;
  round: string;
  home: string;
  away: string;
  scheduledAt: string;
  durationMin: number;
  resourceId: string;
  resource: string;
  refereeUserId: string | null;
  referee: string | null;
};

function toLocalInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TournamentScheduleManager({ tournamentId }: { tournamentId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [startAt, setStartAt] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [roundBreakMin, setRoundBreakMin] = useState(10);
  const [participantRestMin, setParticipantRestMin] = useState(10);
  const [assignReferees, setAssignReferees] = useState(false);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [previewSignature, setPreviewSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"preview" | "apply" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const signature = useMemo(() => JSON.stringify({
    startAt,
    durationMin,
    roundBreakMin,
    participantRestMin,
    assignReferees
  }), [startAt, durationMin, roundBreakMin, participantRestMin, assignReferees]);

  async function load(resetForm = false) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule`, { cache: "no-store" });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        setOverview(null);
        setError(String(payload.message || "دریافت اطلاعات زمان‌بندی انجام نشد."));
        return;
      }
      const next = payload as unknown as Overview;
      setOverview(next);
      if (resetForm || !startAt) {
        setStartAt(toLocalInput(next.defaults.startAt));
        setDurationMin(next.defaults.durationMin);
        setRoundBreakMin(next.defaults.roundBreakMin);
        setParticipantRestMin(next.defaults.participantRestMin);
      }
    } catch {
      setOverview(null);
      setError("ارتباط با سرور برای دریافت برنامه برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(true); }, [tournamentId]);

  async function submit(mode: "preview" | "apply") {
    if (!startAt) return setError("زمان شروع برنامه را انتخاب کن.");
    setBusy(mode);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          startAt: new Date(startAt).toISOString(),
          durationMin,
          roundBreakMin,
          participantRestMin,
          assignReferees
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        setError(String(payload.message || "زمان‌بندی بازی‌ها انجام نشد."));
        return;
      }
      const nextPlan = Array.isArray(payload.plan) ? payload.plan as PlanItem[] : [];
      setPlan(nextPlan);
      if (mode === "preview") {
        setPreviewSignature(signature);
        setMessage(nextPlan.length ? "برنامه پیشنهادی آماده است. پس از بررسی، آن را ثبت کن." : "بازی زمان‌بندی‌نشده‌ای وجود ندارد.");
      } else {
        setPreviewSignature("");
        setMessage(`${Number(payload.scheduled || 0).toLocaleString("fa-IR")} بازی زمان‌بندی شد.`);
        await load(false);
      }
    } catch {
      setError("ارتباط با سرور برای زمان‌بندی برقرار نشد.");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <Card className="mt-7 p-8 text-center text-[var(--muted)]">در حال دریافت اطلاعات زمان‌بندی...</Card>;
  }
  if (!overview) {
    return <Alert tone="error" className="mt-7">{error || "اطلاعات مسابقه دریافت نشد."}</Alert>;
  }

  const validStatus = ["DRAW_READY", "RUNNING"].includes(overview.tournament.status);
  const canPreview = validStatus
    && Boolean(overview.tournament.venueId)
    && overview.resources.length > 0
    && overview.counts.unscheduled > 0;
  const canApply = canPreview && plan.length > 0 && previewSignature === signature;

  return (
    <div className="mt-7 space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      {!validStatus && <Alert tone="warning">ابتدا قرعه را نهایی کن. زمان‌بندی در وضعیت «قرعه آماده» یا «در حال برگزاری» فعال است.</Alert>}
      {!overview.tournament.venueId && <Alert tone="error">برای مسابقه محل برگزاری تعیین نشده است.</Alert>}
      {overview.tournament.venueId && !overview.resources.length && <Alert tone="error">در این محل، میز یا دستگاه سازگار و فعال وجود ندارد.</Alert>}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{overview.tournament.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {overview.tournament.game} · {overview.tournament.venue || "بدون محل"}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load(false)}>
            <RefreshCcw size={16} />بازبینی
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-[var(--surface-2)] p-4"><CalendarClock size={19} className="text-[var(--brand)]"/><strong className="mt-3 block text-2xl">{overview.counts.total.toLocaleString("fa-IR")}</strong><span className="text-xs text-[var(--muted)]">کل بازی‌ها</span></div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4"><CheckCircle2 size={19} className="text-emerald-500"/><strong className="mt-3 block text-2xl">{overview.counts.scheduled.toLocaleString("fa-IR")}</strong><span className="text-xs text-[var(--muted)]">زمان‌بندی‌شده</span></div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4"><Clock3 size={19} className="text-amber-500"/><strong className="mt-3 block text-2xl">{overview.counts.unscheduled.toLocaleString("fa-IR")}</strong><span className="text-xs text-[var(--muted)]">بدون زمان</span></div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4"><UsersRound size={19} className="text-sky-500"/><strong className="mt-3 block text-2xl">{overview.resources.length.toLocaleString("fa-IR")}</strong><span className="text-xs text-[var(--muted)]">منبع سازگار</span></div>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="font-black">تنظیم برنامه پیشنهادی</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">این تنظیمات فقط روی بازی‌های بدون زمان اعمال می‌شوند و برنامه قبلی را تغییر نمی‌دهند.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Label>شروع برنامه<PersianDatePicker mode="datetime" value={startAt} onChange={(value) => { setStartAt(value); setPreviewSignature(""); }} /></Label>
          <Label>مدت هر بازی (دقیقه)<Input type="number" min="5" max="240" value={durationMin} onChange={(event) => { setDurationMin(Number(event.target.value)); setPreviewSignature(""); }}/></Label>
          <Label>فاصله بین دورها (دقیقه)<Input type="number" min="0" max="120" value={roundBreakMin} onChange={(event) => { setRoundBreakMin(Number(event.target.value)); setPreviewSignature(""); }}/></Label>
          <Label>استراحت هر شرکت‌کننده (دقیقه)<Input type="number" min="0" max="120" value={participantRestMin} onChange={(event) => { setParticipantRestMin(Number(event.target.value)); setPreviewSignature(""); }}/></Label>
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={assignReferees} onChange={(event) => { setAssignReferees(event.target.checked); setPreviewSignature(""); }} />
          تخصیص خودکار داور
          <span className="text-xs font-normal text-[var(--muted)]">({overview.referees.length.toLocaleString("fa-IR")} داور قابل انتخاب)</span>
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" disabled={!canPreview || Boolean(busy)} loading={busy === "preview"} onClick={() => void submit("preview")}>
            <Eye size={16}/>پیش‌نمایش برنامه
          </Button>
          <Button type="button" variant="secondary" disabled={!canApply || Boolean(busy)} loading={busy === "apply"} onClick={() => void submit("apply")}>
            <CheckCircle2 size={16}/>ثبت همین برنامه
          </Button>
          <Button href="/admin/matches" variant="ghost">مدیریت دستی بازی‌ها</Button>
        </div>
      </Card>

      {plan.length > 0 && <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] p-5"><h2 className="font-black">برنامه پیشنهادی</h2><p className="mt-1 text-xs text-[var(--muted)]">تا وقتی تنظیمات بالا تغییر نکند، همین برنامه قابل ثبت است.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-4">بازی</th><th className="p-4">دور</th><th className="p-4">دو طرف</th><th className="p-4">زمان</th><th className="p-4">میز/دستگاه</th><th className="p-4">داور</th></tr></thead>
            <tbody>{plan.map((item) => <tr key={item.matchId} className="border-t border-[var(--line)]"><td className="p-4">#{item.matchNumber.toLocaleString("fa-IR")}</td><td className="p-4">{item.round}</td><td className="p-4 font-bold">{item.home} — {item.away}</td><td className="p-4">{formatDateTime(item.scheduledAt)}</td><td className="p-4">{item.resource}</td><td className="p-4">{item.referee || "بدون داور"}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>}

      {overview.matches.some((match) => match.scheduledAt) && <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] p-5"><h2 className="font-black">بازی‌های ثبت‌شده</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-[var(--surface-2)]"><tr><th className="p-4">بازی</th><th className="p-4">دور</th><th className="p-4">دو طرف</th><th className="p-4">زمان</th><th className="p-4">وضعیت</th></tr></thead><tbody>{overview.matches.filter((match) => match.scheduledAt).map((match) => <tr key={match.id} className="border-t border-[var(--line)]"><td className="p-4">#{match.matchNumber.toLocaleString("fa-IR")}</td><td className="p-4">{match.round}</td><td className="p-4 font-bold">{match.home} — {match.away}</td><td className="p-4">{formatDateTime(match.scheduledAt!)}</td><td className="p-4">{match.status}</td></tr>)}</tbody></table></div>
      </Card>}
    </div>
  );
}
