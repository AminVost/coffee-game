"use client";

import { useState } from "react";
import { BarChart3, CalendarClock, Edit3, ExternalLink, ListChecks, Shuffle, Trash2, Trophy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTournamentStatusLabel } from "@/lib/tournament-definition";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";

type PermissionFlags = { canDraw: boolean; canSchedule: boolean; canManage: boolean };

export function TournamentsManager({ initialItems, permissions }: { initialItems: Tournament[]; permissions: PermissionFlags }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function remove(item: Tournament) {
    if (!window.confirm(`مسابقه «${item.title}» حذف شود؟`)) return;
    setBusyId(item.id); setError(""); setMessage("");
    const response = await fetch(`/api/tournaments/${item.id}`, { method: "DELETE" });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "حذف انجام نشد.");
    setItems((current) => current.filter((row) => row.id !== item.id));
  }

  async function runRanking(item: Tournament) {
    setBusyId(`ranking:${item.id}`); setError(""); setMessage("");
    const response = await fetch("/api/admin/rankings/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: Number(item.id) })
    });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "عملیات انجام نشد.");
    setMessage("رنکینگ محاسبه شد.");
  }

  return <>
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    {message && <Alert tone="success" className="mt-4">{message}</Alert>}
    <Card className="mt-7 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]"><tr><th className="p-4">مسابقه</th><th className="p-4">وضعیت</th><th className="p-4">ثبت‌نام</th><th className="p-4">تاریخ</th><th className="p-4">هزینه</th><th className="p-4">عملیات</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[var(--line)]"><td className="p-4"><strong>{item.title}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.gameTitle} · {item.format}</span></td><td className="p-4"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">{getTournamentStatusLabel(item.status)}</span></td><td className="p-4">{item.registered.toLocaleString("fa-IR")} / {item.capacity.toLocaleString("fa-IR")}</td><td className="p-4 text-[var(--muted)]">{item.date}</td><td className="p-4">{formatToman(item.price)}</td><td className="p-4"><div className="flex flex-wrap gap-2"><Button href={`/tournaments/${item.slug}`} target="_blank" rel="noreferrer" variant="secondary" size="iconSm" aria-label="مشاهده مسابقه"><ExternalLink size={15} /></Button>{permissions.canManage && <Button href={`/admin/tournaments/${item.id}/edit`} variant="secondary" size="iconSm" aria-label="ویرایش کامل"><Edit3 size={15} /></Button>}{permissions.canManage && <Button href={`/admin/tournaments/${item.id}/participants`} variant="secondary" size="sm" aria-label="نهایی‌سازی شرکت‌کنندگان"><ListChecks size={15} />شرکت‌کنندگان</Button>}{permissions.canDraw && <Button href={`/admin/tournaments/${item.id}/draw`} variant="secondary" size="sm" aria-label="مدیریت قرعه و Seed"><Shuffle size={15} />قرعه</Button>}{permissions.canSchedule && <Button href={`/admin/tournaments/${item.id}/schedule`} variant="secondary" size="sm" aria-label="زمان‌بندی بازی‌ها"><CalendarClock size={15} />زمان‌بندی</Button>}{permissions.canManage && <Button href={`/admin/tournaments/${item.id}/completion`} variant="secondary" size="sm" aria-label="پایان مسابقه و تعیین قهرمان"><Trophy size={15} />پایان مسابقه</Button>}{permissions.canSchedule && <Button type="button" disabled={busyId === `ranking:${item.id}`} onClick={() => runRanking(item)} variant="secondary" size="iconSm" aria-label="محاسبه رنکینگ"><BarChart3 size={15} /></Button>}{permissions.canManage && <Button type="button" disabled={busyId === item.id} onClick={() => remove(item)} variant="dangerSoft" size="iconSm" aria-label="حذف"><Trash2 size={15} /></Button>}</div></td></tr>)}</tbody></table></div></Card>
  </>;
}
