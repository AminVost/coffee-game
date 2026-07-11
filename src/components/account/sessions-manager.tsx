/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SessionItem = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "دستگاه ناشناس";
  if (/mobile|android|iphone/i.test(userAgent)) return "موبایل";
  return "رایانه یا لپ‌تاپ";
}

export function SessionsManager() {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/auth/sessions", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت نشست‌ها انجام نشد.");
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  async function revoke(item: SessionItem) {
    if (!window.confirm(item.isCurrent ? "با قطع نشست فعلی از حساب خارج می‌شوید. ادامه می‌دهید؟" : "این نشست قطع شود؟")) return;
    setBusyId(item.id);
    const response = await fetch(`/api/auth/sessions/${item.id}`, { method: "DELETE" });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "قطع نشست انجام نشد.");
    if (item.isCurrent) {
      router.replace("/login");
      router.refresh();
      return;
    }
    setItems((current) => current.filter((session) => session.id !== item.id));
  }

  return <div className="mt-7 grid gap-4">
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    {items.map((item) => {
      const mobile = /mobile|android|iphone/i.test(item.userAgent || "");
      const Icon = mobile ? Smartphone : Laptop;
      return <Card key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)]"><Icon size={21}/></span><div><div className="flex flex-wrap items-center gap-2"><strong>{deviceLabel(item.userAgent)}</strong>{item.isCurrent && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600">نشست فعلی</span>}</div><p className="mt-1 text-xs text-[var(--muted)]" dir="ltr">IP: {item.ipAddress || "نامشخص"}</p><p className="mt-1 max-w-xl truncate text-xs text-[var(--muted)]">{item.userAgent || "User-Agent ثبت نشده"}</p><p className="mt-1 text-xs text-[var(--muted)]">شروع: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p></div></div><Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => revoke(item)}><LogOut size={15}/>{busyId === item.id ? "در حال قطع" : "قطع نشست"}</Button></Card>;
    })}
    {!loading && !items.length && <Card className="p-10 text-center text-sm text-[var(--muted)]">نشست فعالی وجود ندارد.</Card>}
    {loading && <p className="text-sm text-[var(--muted)]">در حال دریافت نشست‌ها...</p>}
  </div>;
}
