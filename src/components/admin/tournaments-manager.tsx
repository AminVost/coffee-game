"use client";

import { useState } from "react";
import { Edit3, ExternalLink, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";

export function TournamentsManager({ initialItems }: { initialItems: Tournament[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function rename(item: Tournament) {
    const title = window.prompt("عنوان جدید مسابقه:", item.title)?.trim();
    if (!title || title === item.title) return;
    setBusyId(item.id); setError("");
    const response = await fetch(`/api/tournaments/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "ویرایش انجام نشد.");
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, title } : row));
  }

  async function remove(item: Tournament) {
    if (!window.confirm(`مسابقه «${item.title}» حذف شود؟`)) return;
    setBusyId(item.id); setError("");
    const response = await fetch(`/api/tournaments/${item.id}`, { method: "DELETE" });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "حذف انجام نشد.");
    setItems((current) => current.filter((row) => row.id !== item.id));
  }

  return <>
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    <Card className="mt-7 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]"><tr><th className="p-4">مسابقه</th><th className="p-4">وضعیت</th><th className="p-4">ثبت‌نام</th><th className="p-4">تاریخ</th><th className="p-4">هزینه</th><th className="p-4">عملیات</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[var(--line)]"><td className="p-4"><strong>{item.title}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.gameTitle} · {item.format}</span></td><td className="p-4"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">{item.status}</span></td><td className="p-4">{item.registered.toLocaleString("fa-IR")} / {item.capacity.toLocaleString("fa-IR")}</td><td className="p-4 text-[var(--muted)]">{item.date}</td><td className="p-4">{formatToman(item.price)}</td><td className="p-4"><div className="flex gap-2"><Button href={`/tournaments/${item.slug}`} target="_blank" rel="noreferrer" variant="secondary" size="iconSm" aria-label="مشاهده مسابقه"><ExternalLink size={15} /></Button><Button type="button" disabled={busyId === item.id} onClick={() => rename(item)} variant="secondary" size="iconSm" aria-label="تغییر عنوان"><Edit3 size={15} /></Button><Button type="button" disabled={busyId === item.id} onClick={() => remove(item)} variant="dangerSoft" size="iconSm" aria-label="حذف"><Trash2 size={15} /></Button></div></td></tr>)}</tbody></table></div></Card>
  </>;
}
