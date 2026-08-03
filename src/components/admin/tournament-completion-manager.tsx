"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Medal,
  RefreshCw,
  Trophy
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTournamentStatusLabel } from "@/lib/tournament-definition";

type Participant = {
  key: string;
  name: string;
  seed: number | null;
};

type Standing = {
  rank: number;
  participant: Participant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
};

type Snapshot = {
  tournamentId: number;
  title: string;
  status: string;
  format: string;
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
  openDisputes: number;
  progressPercent: number;
  champion: Participant | null;
  runnerUp: Participant | null;
  thirdPlace: Participant | null;
  standings: Standing[];
  blockers: string[];
  warnings: string[];
  readyToFinalize: boolean;
  completed: boolean;
};

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function ResultCard({
  title,
  participant,
  icon
}: {
  title: string;
  participant: Participant | null;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
        {icon}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{title}</p>
      <strong className="mt-1 block text-lg">{participant?.name || "هنوز مشخص نشده"}</strong>
      {participant?.seed && (
        <span className="mt-2 inline-block rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
          Seed {participant.seed.toLocaleString("fa-IR")}
        </span>
      )}
    </Card>
  );
}

export function TournamentCompletionManager({ tournamentId }: { tournamentId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"sync" | "finalize" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/completion`, {
      cache: "no-store"
    });
    const payload = await readPayload(response);
    setLoading(false);
    if (!response.ok) {
      setError(String(payload.message || "دریافت وضعیت مسابقه انجام نشد."));
      return;
    }
    setSnapshot(payload as unknown as Snapshot);
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: "sync" | "finalize") {
    setBusy(action);
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await readPayload(response);
    setBusy(null);
    if (!response.ok) {
      setError(String(payload.message || "عملیات انجام نشد."));
      return;
    }
    setMessage(action === "sync"
      ? "وضعیت مرحله بعد و پایان مسابقه دوباره بررسی شد."
      : "مسابقه با موفقیت پایان یافت و قهرمان ثبت شد.");
    await load();
  }

  if (loading && !snapshot) {
    return <Card className="mt-7 p-10 text-center text-[var(--muted)]">در حال بررسی وضعیت مسابقه...</Card>;
  }

  return (
    <div className="mt-7 grid gap-6">
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {snapshot && (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[var(--muted)]">{snapshot.format}</p>
                <h2 className="mt-1 text-2xl font-black">{snapshot.title}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  وضعیت فعلی: {getTournamentStatusLabel(snapshot.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!snapshot.completed && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy === "sync"}
                    onClick={() => void run("sync")}
                  >
                    <RefreshCw size={16} /> بررسی و ادامه خودکار
                  </Button>
                )}
                {snapshot.readyToFinalize && (
                  <Button
                    type="button"
                    loading={busy === "finalize"}
                    onClick={() => void run("finalize")}
                  >
                    <CheckCircle2 size={16} /> پایان نهایی مسابقه
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width]"
                style={{ width: `${snapshot.progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
              <span>
                {snapshot.completedMatches.toLocaleString("fa-IR")} از {snapshot.totalMatches.toLocaleString("fa-IR")} بازی پایان یافته
              </span>
              <span>{snapshot.progressPercent.toLocaleString("fa-IR")}%</span>
            </div>
          </Card>

          {snapshot.completed && snapshot.champion && (
            <Alert tone="success">
              <span className="inline-flex items-center gap-2 font-black">
                <Crown size={18} /> قهرمان نهایی: {snapshot.champion.name}
              </span>
            </Alert>
          )}

          {!!snapshot.blockers.length && (
            <Alert tone="warning">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <strong>مواردی که مانع پایان مسابقه هستند:</strong>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {snapshot.blockers.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </div>
            </Alert>
          )}

          {!!snapshot.warnings.length && (
            <Alert tone="info">
              {snapshot.warnings.map((item) => <p key={item}>{item}</p>)}
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <ResultCard title="قهرمان" participant={snapshot.champion} icon={<Trophy size={22} />} />
            <ResultCard title="نایب‌قهرمان" participant={snapshot.runnerUp} icon={<Medal size={22} />} />
            <ResultCard title="مقام سوم" participant={snapshot.thirdPlace} icon={<Medal size={22} />} />
          </div>

          {!!snapshot.standings.length && (
            <Card className="overflow-hidden">
              <div className="border-b border-[var(--line)] p-5">
                <h3 className="font-black">جدول نهایی</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
                    <tr>
                      <th className="p-4">رتبه</th>
                      <th className="p-4">شرکت‌کننده</th>
                      <th className="p-4">بازی</th>
                      <th className="p-4">برد</th>
                      <th className="p-4">مساوی</th>
                      <th className="p-4">باخت</th>
                      <th className="p-4">تفاضل</th>
                      <th className="p-4">امتیاز</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.standings.map((item) => (
                      <tr key={item.participant.key} className="border-t border-[var(--line)]">
                        <td className="p-4 font-black">{item.rank.toLocaleString("fa-IR")}</td>
                        <td className="p-4">{item.participant.name}</td>
                        <td className="p-4">{item.played.toLocaleString("fa-IR")}</td>
                        <td className="p-4">{item.wins.toLocaleString("fa-IR")}</td>
                        <td className="p-4">{item.draws.toLocaleString("fa-IR")}</td>
                        <td className="p-4">{item.losses.toLocaleString("fa-IR")}</td>
                        <td className="p-4">{(item.scored - item.conceded).toLocaleString("fa-IR")}</td>
                        <td className="p-4 font-black">{item.points.toLocaleString("fa-IR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
