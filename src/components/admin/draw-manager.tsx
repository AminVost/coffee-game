/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Dices, GripVertical, RefreshCcw, Save, Shuffle, Trash2, WandSparkles } from "lucide-react";
import { TournamentBracket } from "@/components/tournament-bracket";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Participant = {
  entryId: number;
  registrationId: number;
  key: string;
  name: string;
  mobile: string | null;
  seed: number | null;
};

type Match = {
  roundId: number;
  roundTitle: string;
  roundNumber: number;
  stage: string;
  matchId: number;
  matchNumber: number;
  status: string;
  scheduledAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeKey: string | null;
  awayKey: string | null;
  homeName: string | null;
  awayName: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
};

type DrawData = {
  tournament: {
    id: string;
    title: string;
    status: string;
    format: string;
    drawMode: "random" | "seeded" | "custom";
    minimumParticipants: number;
    participantType: string;
    category: "knockout" | "league" | "group" | "swiss" | "double";
  };
  participants: Participant[];
  matches: Match[];
  readyForDraw: boolean;
  blockers: Array<{ code: string; message: string }>;
  canReset: boolean;
  resetBlockedReason: string | null;
  drawExists: boolean;
};

type Pairing = { homeKey: string | null; awayKey: string | null };
type Preview = {
  category: string;
  drawMode: string;
  bracketSize: number;
  orderedKeys: string[];
  slots: Array<string | null>;
  pairings: Pairing[];
  warnings: string[];
};

function nextPowerOfTwo(value: number) {
  let size = 2;
  while (size < Math.max(2, value)) size *= 2;
  return size;
}

const drawModeLabels = {
  random: "تصادفی",
  seeded: "Seed شده",
  custom: "دستی"
} as const;

export function DrawManager({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<DrawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seedDraft, setSeedDraft] = useState<Record<string, string>>( {} );
  const [manualSlots, setManualSlots] = useState<Array<string | null>>([]);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت اطلاعات قرعه انجام نشد.");
    setData(payload);
    setSeedDraft(Object.fromEntries(payload.participants.map((participant: Participant) => [participant.key, participant.seed === null ? "" : String(participant.seed)])));
    if (!payload.drawExists) {
      const pairingCategory = ["knockout", "double"].includes(payload.tournament.category);
      const slotCount = pairingCategory ? nextPowerOfTwo(payload.participants.length) : payload.participants.length;
      setManualSlots((current) => current.length === slotCount ? current : [
        ...payload.participants.map((participant: Participant) => participant.key),
        ...Array(Math.max(0, slotCount - payload.participants.length)).fill(null)
      ]);
    }
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);

  const participantByKey = useMemo(() => new Map((data?.participants || []).map((participant) => [participant.key, participant])), [data]);
  const assignedKeys = useMemo(() => new Set(manualSlots.filter((key): key is string => Boolean(key))), [manualSlots]);
  const unassigned = useMemo(() => (data?.participants || []).filter((participant) => !assignedKeys.has(participant.key)), [data, assignedKeys]);

  function placeParticipant(slotIndex: number, key: string) {
    setManualSlots((current) => {
      const next = current.map((value) => value === key ? null : value);
      next[slotIndex] = key;
      return next;
    });
    setPreview(null);
  }

  function pairingsFromSlots() {
    const pairings: Pairing[] = [];
    for (let index = 0; index < manualSlots.length; index += 2) {
      const pairing = { homeKey: manualSlots[index], awayKey: manualSlots[index + 1] };
      if (pairing.homeKey || pairing.awayKey) pairings.push(pairing);
    }
    return pairings;
  }

  async function saveSeeds() {
    if (!data) return;
    setBusy("seeds"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seeds: data.participants.map((participant) => ({
          entryId: participant.entryId,
          seed: seedDraft[participant.key]?.trim() ? Number(seedDraft[participant.key]) : null
        }))
      })
    });
    const payload = await response.json();
    setBusy("");
    if (!response.ok) return setError(payload.message || "ذخیره Seedها انجام نشد.");
    setMessage("Seed شرکت‌کنندگان ذخیره شد.");
    setPreview(null);
    await load();
  }

  function autoSeed() {
    if (!data) return;
    setSeedDraft(Object.fromEntries(data.participants.map((participant, index) => [participant.key, String(index + 1)])));
    setPreview(null);
  }

  async function run(action: "preview" | "generate" | "regenerate") {
    if (!data) return;
    if (data.tournament.drawMode === "seeded" && !seedComplete) {
      setError(`برای قرعه Seed شده، Seedها باید دقیقاً از ۱ تا ${data.participants.length.toLocaleString("fa-IR")} تکمیل شوند.`);
      return;
    }
    if (action === "generate" && !preview) {
      setError("ابتدا پیش‌نمایش قرعه را بسازید و سپس همان پیش‌نمایش را ثبت کنید.");
      return;
    }
    if (action === "regenerate" && !window.confirm("قرعه فعلی حذف و یک قرعه تصادفی جدید ساخته شود؟")) {
      return;
    }

    setBusy(action); setError(""); setMessage("");
    const body: Record<string, unknown> = { action };
    if (data.tournament.drawMode === "custom") {
      if (["knockout", "double"].includes(data.tournament.category)) {
        body.pairings = pairingsFromSlots();
      } else {
        body.participantOrder = manualSlots.filter((key): key is string => Boolean(key));
      }
    } else if (preview && action !== "preview") {
      body.participantOrder = preview.orderedKeys;
    }
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    setBusy("");
    if (!response.ok) return setError(payload.message || "عملیات قرعه انجام نشد.");
    if (action === "preview") {
      setPreview(payload);
      return setMessage("پیش‌نمایش ساخته شد؛ ثبت نهایی دقیقاً همین ترتیب را ذخیره می‌کند.");
    }
    setPreview(null);
    setMessage(action === "regenerate" ? "قرعه با موفقیت بازسازی شد." : "قرعه با موفقیت ثبت شد.");
    await load();
  }

  async function reset() {
    if (!window.confirm("قرعه حذف شود؟ این کار فقط تا قبل از شروع بازی‌ها ممکن است.")) return;
    setBusy("reset"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, { method: "DELETE" });
    const payload = await response.json();
    setBusy("");
    if (!response.ok) return setError(payload.message || "حذف قرعه انجام نشد.");
    setPreview(null);
    setMessage("قرعه حذف شد و مسابقه به وضعیت ثبت‌نام بسته بازگشت.");
    await load();
  }

  function manualSlot(slotIndex: number, emptyLabel: string) {
    const key = manualSlots[slotIndex];
    const participant = key ? participantByKey.get(key) : null;
    return <div
      key={slotIndex}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => { if (draggedKey) placeParticipant(slotIndex, draggedKey); setDraggedKey(null); }}
      className="min-h-20 rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-3"
    >
      <div className="flex h-full items-center justify-between gap-2">
        {participant ? <button type="button" draggable onDragStart={() => setDraggedKey(participant.key)} className="flex min-w-0 cursor-grab items-center gap-2 text-right text-sm font-bold"><GripVertical size={15}/><span className="truncate">{participant.name}</span></button> : <span className="text-xs text-[var(--muted)]">{emptyLabel}</span>}
        {participant && <button type="button" className="text-xs text-red-500" onClick={() => { setManualSlots((current) => current.map((value, index) => index === slotIndex ? null : value)); setPreview(null); }}>حذف</button>}
      </div>
    </div>;
  }

  if (loading && !data) return <Card className="mt-7 p-10 text-center text-[var(--muted)]">در حال دریافت اطلاعات قرعه...</Card>;
  if (!data) return <Alert tone="error" className="mt-6">{error || "اطلاعات مسابقه دریافت نشد."}</Alert>;

  const seedNumbers = data.participants
    .map((participant) => Number(seedDraft[participant.key]))
    .filter((seed) => Number.isInteger(seed) && seed > 0)
    .sort((left, right) => left - right);
  const seedComplete = data.tournament.drawMode !== "seeded" || (
    seedNumbers.length === data.participants.length
    && seedNumbers.every((seed, index) => seed === index + 1)
  );
  const canCreate = data.readyForDraw && seedComplete;

  return <div className="mt-7 grid gap-6">
    {error && <Alert tone="error">{error}</Alert>}
    {message && <Alert tone="success">{message}</Alert>}

    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-black">{data.tournament.title}</h2><p className="mt-2 text-sm text-[var(--muted)]">{data.tournament.format} · روش قرعه: {drawModeLabels[data.tournament.drawMode]} · وضعیت: {data.tournament.status}</p></div>
        <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm"><b>{data.participants.length.toLocaleString("fa-IR")}</b> شرکت‌کننده تأییدشده · حداقل {data.tournament.minimumParticipants.toLocaleString("fa-IR")}</div>
      </div>
      {!data.drawExists && !data.readyForDraw && <div className="mt-5 grid gap-2">{data.blockers.length
        ? data.blockers.map((blocker) => <Alert key={blocker.code} tone="warning">{blocker.message}</Alert>)
        : <Alert tone="warning">فهرست شرکت‌کنندگان هنوز برای قرعه نهایی نشده است.</Alert>}
      </div>}
      {!data.drawExists && data.tournament.drawMode === "seeded" && !seedComplete && <Alert tone="warning" className="mt-5">Seedها باید کامل، یکتا و بدون فاصله از ۱ تا {data.participants.length.toLocaleString("fa-IR")} باشند.</Alert>}
    </Card>

    {!data.drawExists && data.tournament.drawMode === "seeded" && <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Seed بندی شرکت‌کنندگان</h2><p className="mt-1 text-xs text-[var(--muted)]">Seedهای کمتر در موقعیت‌های استاندارد براکت قرار می‌گیرند و Seedهای برتر در دور اول مقابل هم قرار نمی‌گیرند.</p></div><div className="flex gap-2"><Button type="button" variant="secondary" size="sm" disabled={!data.readyForDraw} onClick={autoSeed}><WandSparkles size={15}/>Seed خودکار</Button><Button type="button" size="sm" disabled={!data.readyForDraw} loading={busy === "seeds"} onClick={saveSeeds}><Save size={15}/>ذخیره Seed</Button></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.participants.map((participant) => <div key={participant.key} className="grid grid-cols-[1fr_90px] items-center gap-3 rounded-2xl border border-[var(--line)] p-3"><div className="min-w-0"><strong className="block truncate">{participant.name}</strong><span className="text-xs text-[var(--muted)]" dir="ltr">{participant.mobile || participant.key}</span></div><Input type="number" min="1" max="5000" placeholder="Seed" value={seedDraft[participant.key] || ""} onChange={(event) => { setSeedDraft((current) => ({ ...current, [participant.key]: event.target.value })); setPreview(null); }}/></div>)}</div>
    </Card>}

    {!data.drawExists && data.tournament.drawMode === "custom" && <Card className="p-5 sm:p-7">
      <h2 className="font-black">{["knockout", "double"].includes(data.tournament.category) ? "قرعه دستی Drag & Drop" : "ترتیب دستی شرکت‌کنندگان"}</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">{["knockout", "double"].includes(data.tournament.category) ? "هر شرکت‌کننده را در یکی از خانه‌ها رها کن. دو خانه متوالی یک بازی را می‌سازند؛ خانه خالی به معنی Bye است." : "ترتیب شرکت‌کنندگان را با Drag & Drop تعیین کن؛ موتور مسابقه گروه‌ها یا Pairingها را بر اساس همین ترتیب می‌سازد."}</p>
      {unassigned.length > 0 && <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-dashed border-[var(--line)] p-4">{unassigned.map((participant) => <button key={participant.key} type="button" draggable onDragStart={() => setDraggedKey(participant.key)} className="flex cursor-grab items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-bold active:cursor-grabbing"><GripVertical size={15}/>{participant.name}</button>)}</div>}
      {["knockout", "double"].includes(data.tournament.category)
        ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{Array.from({ length: manualSlots.length / 2 }, (_, pairIndex) => <div key={pairIndex} className="rounded-2xl border border-[var(--line)] p-3"><p className="mb-3 text-xs font-black text-[var(--muted)]">بازی {(pairIndex + 1).toLocaleString("fa-IR")}</p><div className="grid gap-2 sm:grid-cols-2">{manualSlot(pairIndex * 2, "بازیکن اول / Bye")}{manualSlot(pairIndex * 2 + 1, "بازیکن دوم / Bye")}</div></div>)}</div>
        : <div className="mt-5 grid gap-3 md:grid-cols-2">{manualSlots.map((_, slotIndex) => <div key={slotIndex} className="grid grid-cols-[40px_1fr] items-center gap-3"><span className="text-center text-xs font-black text-[var(--muted)]">{(slotIndex + 1).toLocaleString("fa-IR")}</span>{manualSlot(slotIndex, "شرکت‌کننده را اینجا رها کن")}</div>)}</div>}
    </Card>}

    {!data.drawExists && <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" loading={busy === "preview"} disabled={!canCreate} onClick={() => run("preview")}><Dices size={17}/>پیش‌نمایش قرعه</Button><Button type="button" loading={busy === "generate"} disabled={!canCreate || !preview} onClick={() => run("generate")}><Shuffle size={17}/>ثبت همین پیش‌نمایش</Button></div>
      {preview && <div className="mt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">{preview.pairings.length ? "پیش‌نمایش دور اول" : "پیش‌نمایش ترتیب شرکت‌کنندگان"}</h3>{preview.pairings.length ? <span className="text-xs text-[var(--muted)]">اندازه براکت: {preview.bracketSize.toLocaleString("fa-IR")}</span> : null}</div>{preview.warnings?.map((warning) => <Alert key={warning} tone="warning" className="mb-3">{warning}</Alert>)}{preview.pairings.length ? <div className="grid gap-3 md:grid-cols-2">{preview.pairings.map((pairing, index) => <div key={index} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-center"><strong>{pairing.homeKey ? participantByKey.get(pairing.homeKey)?.name : "استراحت"}</strong><span className="text-xs text-[var(--muted)]">VS</span><strong>{pairing.awayKey ? participantByKey.get(pairing.awayKey)?.name : "استراحت"}</strong></div>)}</div> : <div className="grid gap-2 md:grid-cols-2">{preview.orderedKeys.map((key, index) => <div key={key} className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand)]/12 text-xs font-black text-[var(--brand)]">{(index + 1).toLocaleString("fa-IR")}</span><strong>{participantByKey.get(key)?.name}</strong></div>)}</div>}</div>}
    </Card>}

    {data.drawExists && <Card className="p-5 sm:p-7"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">براکت ثبت‌شده</h2><p className="mt-1 text-xs text-[var(--muted)]">حذف یا قرعه مجدد فقط پیش از شروع بازی‌ها امکان‌پذیر است.</p></div><div className="flex flex-wrap gap-2"><Button href={`/admin/tournaments/${tournamentId}/schedule`} variant="secondary"><CalendarClock size={16}/>زمان‌بندی بازی‌ها</Button>{data.canReset && data.tournament.drawMode === "random" && <Button type="button" variant="secondary" loading={busy === "regenerate"} onClick={() => run("regenerate")}><RefreshCcw size={16}/>قرعه تصادفی مجدد</Button>}{data.canReset && <Button type="button" variant="dangerSoft" loading={busy === "reset"} onClick={reset}><Trash2 size={16}/>حذف قرعه</Button>}</div></div>{!data.canReset && data.resetBlockedReason && <Alert tone="warning" className="mb-5">{data.resetBlockedReason}</Alert>}<TournamentBracket matches={data.matches}/></Card>}
  </div>;
}
