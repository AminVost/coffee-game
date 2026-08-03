/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Edit3,
  PauseCircle,
  Play,
  Radio,
  RotateCcw,
  Save,
  Settings2,
  Trophy,
  X
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MATCH_STATUS_LABELS, type MatchCategory } from "@/lib/match-rules";

type MatchItem = {
  id: string;
  matchNumber: number;
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
  participantCount: number;
  hasOpenDispute: boolean;
  resultRules: {
    category: MatchCategory;
    maxScore: number;
    targetScore: number | null;
    allowDraw: boolean;
  };
};

type Option = { id: string; title: string };
type DialogMode = "setup" | "score" | "correct" | "postpone";
type DialogState = { mode: DialogMode; item: MatchItem } | null;

const statusOptions = [
  { value: "ALL", label: "همه وضعیت‌ها" },
  { value: "LIVE", label: "در حال برگزاری" },
  { value: "READY", label: "آماده شروع" },
  { value: "POSTPONED", label: "به تعویق افتاده" },
  { value: "PENDING", label: "در انتظار برنامه" },
  { value: "COMPLETED", label: "پایان‌یافته" }
];

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function scoreText(value: number | null) {
  return value === null ? "–" : value.toLocaleString("fa-IR");
}

export function MatchesManager() {
  const [items, setItems] = useState<MatchItem[]>([]);
  const [resources, setResources] = useState<Option[]>([]);
  const [referees, setReferees] = useState<Option[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [resourceId, setResourceId] = useState("none");
  const [refereeUserId, setRefereeUserId] = useState("none");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [initialMatchId, setInitialMatchId] = useState<string | null>(null);

  async function load(matchId = initialMatchId) {
    setLoading(true);
    setError("");
    const suffix = matchId ? `?matchId=${encodeURIComponent(matchId)}` : "";
    const response = await fetch(`/api/admin/matches${suffix}`, { cache: "no-store" });
    const payload = await readPayload(response);
    setLoading(false);
    if (!response.ok) {
      setError(String(payload.message || "دریافت بازی‌ها انجام نشد."));
      return;
    }
    setItems((payload.items as MatchItem[]) || []);
    setResources((payload.resources as Option[]) || []);
    setReferees((payload.referees as Option[]) || []);
    setCanManageAll(Boolean(payload.canManageAll));
  }

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("matchId");
    setInitialMatchId(matchId);
    void load(matchId);
  }, []);

  const visibleItems = useMemo(
    () => statusFilter === "ALL" ? items : items.filter((item) => item.status === statusFilter),
    [items, statusFilter]
  );

  function openDialog(item: MatchItem, mode: DialogMode) {
    setDialog({ item, mode });
    setHomeScore(item.homeScore ?? 0);
    setAwayScore(item.awayScore ?? 0);
    setResourceId(item.resourceId || "none");
    setRefereeUserId(item.refereeUserId || "none");
    setScheduledAt(toLocalInput(item.scheduledAt));
    setDurationMin(item.durationMin || 30);
    setNotes(mode === "postpone" || mode === "correct" ? "" : item.notes || "");
    setError("");
    setMessage("");
  }

  async function requestAction(item: MatchItem, body: Record<string, unknown>, successMessage: string) {
    setBusyId(item.id);
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/matches/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await readPayload(response);
    setBusyId(null);
    setSaving(false);
    if (!response.ok) {
      setError(String(payload.message || "ذخیره اطلاعات بازی انجام نشد."));
      return false;
    }
    setDialog(null);
    setMessage(successMessage);
    await load(initialMatchId);
    return true;
  }

  async function saveSetup() {
    if (!dialog) return;
    await requestAction(dialog.item, {
      action: "setup",
      resourceId: resourceId !== "none" ? Number(resourceId) : null,
      refereeUserId: refereeUserId !== "none" ? Number(refereeUserId) : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      durationMin,
      notes: notes || null
    }, "برنامه بازی ذخیره شد.");
  }

  async function saveScore(finalResult: boolean) {
    if (!dialog) return;
    const action = dialog.mode === "correct" ? "correct" : finalResult ? "complete" : "score";
    await requestAction(dialog.item, {
      action,
      homeScore,
      awayScore,
      ...(action === "correct" ? { reason: notes } : { notes: notes || null })
    }, action === "complete"
      ? "نتیجه نهایی ثبت شد."
      : action === "correct"
        ? "نتیجه بازی اصلاح شد."
        : "امتیاز زنده ذخیره شد.");
  }

  async function postpone() {
    if (!dialog) return;
    await requestAction(dialog.item, { action: "postpone", reason: notes }, "بازی به تعویق افتاد.");
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Label>فیلتر وضعیت
            <SelectField value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
          </Label>
        </div>
        {initialMatchId && (
          <Button href="/admin/matches" variant="secondary" size="sm">نمایش همه بازی‌ها</Button>
        )}
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      {message && <Alert tone="success" className="mt-4">{message}</Alert>}

      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        {visibleItems.map((match) => (
          <Card key={match.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--muted)]">{match.tournament} · بازی {match.matchNumber.toLocaleString("fa-IR")}</p>
                <strong className="mt-1 block">{match.round}</strong>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${match.status === "LIVE" ? "bg-red-500/10 text-red-500" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
                {match.status === "LIVE" && <Radio className="ml-1 inline" size={13} />}
                {MATCH_STATUS_LABELS[match.status] || match.status}
              </span>
            </div>

            <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
              <strong>{match.home}</strong>
              <div className="rounded-2xl bg-[var(--surface-2)] px-5 py-3 text-xl font-black">
                {scoreText(match.homeScore)} : {scoreText(match.awayScore)}
              </div>
              <strong>{match.away}</strong>
            </div>

            {match.participantCount < 2 && (
              <Alert tone="warning" className="mb-4">طرفین این بازی هنوز کامل نشده‌اند.</Alert>
            )}
            {match.hasOpenDispute && (
              <Alert tone="warning" className="mb-4">
                این بازی اعتراض باز دارد و تا تعیین تکلیف آن، نتیجه نهایی قابل ثبت یا اصلاح نیست.
              </Alert>
            )}

            <div className="grid gap-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] sm:grid-cols-2">
              <span>{match.resource}</span>
              <span>{match.referee ? `داور: ${match.referee}` : "بدون داور"}</span>
              {match.scheduledAt && (
                <span className="flex items-center gap-1">
                  <CalendarClock size={13} />
                  {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(match.scheduledAt))}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {canManageAll && ["PENDING", "READY", "POSTPONED"].includes(match.status) && (
                <Button type="button" variant="secondary" size="sm" onClick={() => openDialog(match, "setup")}>
                  <Settings2 size={14} /> تنظیم برنامه
                </Button>
              )}
              {match.status === "READY" && (
                <Button
                  type="button"
                  size="sm"
                  loading={busyId === match.id}
                  disabled={match.participantCount < 2}
                  onClick={() => void requestAction(match, { action: "start" }, "بازی شروع شد.")}
                >
                  <Play size={14} /> شروع بازی
                </Button>
              )}
              {match.status === "LIVE" && (
                <Button type="button" size="sm" onClick={() => openDialog(match, "score")}>
                  <Edit3 size={14} /> ثبت امتیاز
                </Button>
              )}
              {["READY", "LIVE"].includes(match.status) && (
                <Button type="button" variant="dangerSoft" size="sm" onClick={() => openDialog(match, "postpone")}>
                  <PauseCircle size={14} /> تعویق
                </Button>
              )}
              {match.status === "POSTPONED" && (
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  loading={busyId === match.id}
                  onClick={() => void requestAction(match, { action: "ready" }, "بازی به حالت آماده بازگشت.")}
                >
                  <RotateCcw size={14} /> بازگشت به آماده
                </Button>
              )}
              {match.status === "COMPLETED" && canManageAll && match.participantCount === 2 && (
                <Button type="button" variant="outline" size="sm" onClick={() => openDialog(match, "correct")}>
                  <Trophy size={14} /> اصلاح نتیجه
                </Button>
              )}
              {match.hasOpenDispute && (
                <Button href="/admin/disputes" variant="secondary" size="sm">
                  <AlertTriangle size={14} /> رسیدگی به اعتراض
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!loading && !visibleItems.length && (
          <p className="col-span-full p-10 text-center text-[var(--muted)]">بازی قابل مدیریتی در این وضعیت وجود ندارد.</p>
        )}
        {loading && <p className="col-span-full p-10 text-center text-[var(--muted)]">در حال دریافت...</p>}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/60 p-4">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  {dialog.mode === "setup" && "تنظیم برنامه بازی"}
                  {dialog.mode === "score" && "ثبت امتیاز بازی"}
                  {dialog.mode === "correct" && "اصلاح نتیجه نهایی"}
                  {dialog.mode === "postpone" && "تعویق بازی"}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">{dialog.item.home} مقابل {dialog.item.away}</p>
              </div>
              <Button type="button" onClick={() => setDialog(null)} variant="secondary" size="iconSm"><X size={18} /></Button>
            </div>

            {dialog.mode === "setup" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Label>مدت بازی (دقیقه)
                  <Input type="number" min="5" max="240" value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} />
                </Label>
                <Label>زمان بازی
                  <PersianDatePicker mode="datetime" value={scheduledAt} onChange={setScheduledAt} />
                </Label>
                <Label>میز یا دستگاه
                  <SelectField value={resourceId} onValueChange={setResourceId} options={[{ value: "none", label: "بدون تخصیص" }, ...resources.map((item) => ({ value: item.id, label: item.title }))]} />
                </Label>
                <Label>داور
                  <SelectField value={refereeUserId} onValueChange={setRefereeUserId} options={[{ value: "none", label: "بدون داور" }, ...referees.map((item) => ({ value: item.id, label: item.title }))]} />
                </Label>
                <Label className="sm:col-span-2">یادداشت
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" />
                </Label>
              </div>
            )}

            {(dialog.mode === "score" || dialog.mode === "correct") && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Label>امتیاز {dialog.item.home}
                  <Input type="number" min="0" max={dialog.item.resultRules.maxScore} value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value))} />
                </Label>
                <Label>امتیاز {dialog.item.away}
                  <Input type="number" min="0" max={dialog.item.resultRules.maxScore} value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value))} />
                </Label>
                <div className="sm:col-span-2 rounded-2xl bg-[var(--surface-2)] p-3 text-xs leading-6 text-[var(--muted)]">
                  حداکثر امتیاز مجاز: {dialog.item.resultRules.maxScore.toLocaleString("fa-IR")}
                  {dialog.item.resultRules.targetScore && ` · امتیاز هدف: ${dialog.item.resultRules.targetScore.toLocaleString("fa-IR")}`}
                  {` · نتیجه مساوی ${dialog.item.resultRules.allowDraw ? "مجاز است" : "مجاز نیست"}`}
                </div>
                <Label className="sm:col-span-2">
                  {dialog.mode === "correct" ? "دلیل اصلاح نتیجه" : "یادداشت"}
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" />
                </Label>
              </div>
            )}

            {dialog.mode === "postpone" && (
              <div className="mt-6">
                <Label>دلیل تعویق
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-32" placeholder="دلیل تعویق بازی را بنویسید." />
                </Label>
              </div>
            )}

            {error && <Alert tone="error" className="mt-4">{error}</Alert>}
            {dialog.item.hasOpenDispute && dialog.mode === "score" && (
              <Alert tone="warning" className="mt-4">تا زمان تعیین تکلیف اعتراض، فقط امتیاز زنده قابل ذخیره است و پایان بازی مسدود خواهد بود.</Alert>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialog(null)}>انصراف</Button>
              {dialog.mode === "setup" && (
                <Button type="button" onClick={() => void saveSetup()} loading={saving}><Save size={16} />ذخیره برنامه</Button>
              )}
              {dialog.mode === "score" && (
                <>
                  <Button type="button" variant="secondary" onClick={() => void saveScore(false)} loading={saving}>ذخیره امتیاز زنده</Button>
                  <Button type="button" onClick={() => void saveScore(true)} loading={saving} disabled={dialog.item.hasOpenDispute}><Trophy size={16} />پایان بازی</Button>
                </>
              )}
              {dialog.mode === "correct" && (
                <Button type="button" onClick={() => void saveScore(true)} loading={saving} disabled={!notes.trim()}><Save size={16} />ثبت اصلاح نتیجه</Button>
              )}
              {dialog.mode === "postpone" && (
                <Button type="button" variant="danger" onClick={() => void postpone()} loading={saving} disabled={notes.trim().length < 3}><PauseCircle size={16} />ثبت تعویق</Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
