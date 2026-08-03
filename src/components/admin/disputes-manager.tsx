/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  id: string;
  matchId: string;
  status: string;
  reason: string;
  resolution: string | null;
  createdAt: string;
  submitter: string;
  tournament: string;
  home: string;
  away: string;
};

const statusLabels: Record<string, string> = {
  open: "باز",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  resolved: "رسیدگی‌شده"
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

export function AdminDisputesManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [status, setStatus] = useState("resolved");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/disputes", { cache: "no-store" });
    const payload = await readPayload(response);
    setLoading(false);
    if (!response.ok) {
      setError(String(payload.message || "دریافت اعتراض‌ها انجام نشد."));
      return;
    }
    setItems((payload.items as Item[]) || []);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/admin/disputes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution })
    });
    const payload = await readPayload(response);
    setSaving(false);
    if (!response.ok) {
      setError(String(payload.message || "رسیدگی انجام نشد."));
      return;
    }
    setSelected(null);
    setResolution("");
    await load();
  }

  return (
    <>
      <div className="mt-7 grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong>{item.tournament} · {item.home} - {item.away}</strong>
                <p className="mt-1 text-xs text-[var(--muted)]">ثبت‌کننده: {item.submitter}</p>
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold">
                {statusLabels[item.status] || item.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.reason}</p>
            {item.resolution && <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm">{item.resolution}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.status === "open" && (
                <Button size="sm" onClick={() => { setSelected(item); setStatus("resolved"); setResolution(""); }}>
                  رسیدگی
                </Button>
              )}
              {item.status === "accepted" && (
                <Button href={`/admin/matches?matchId=${item.matchId}`} variant="outline" size="sm">
                  اصلاح نتیجه بازی
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!loading && !items.length && <Card className="p-8 text-center text-[var(--muted)]">اعتراضی وجود ندارد.</Card>}
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      {selected && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-xl font-black">پاسخ به اعتراض</h2>
            <div className="mt-5 grid gap-4">
              <Label>تصمیم
                <SelectField
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "accepted", label: "پذیرفته؛ نتیجه باید اصلاح شود" },
                    { value: "rejected", label: "ردشده" },
                    { value: "resolved", label: "رسیدگی‌شده بدون تغییر نتیجه" }
                  ]}
                />
              </Label>
              {status === "accepted" && (
                <Alert tone="warning">پس از ثبت پاسخ، از دکمه «اصلاح نتیجه بازی» امتیاز صحیح را وارد کن.</Alert>
              )}
              <Label>پاسخ
                <Textarea className="min-h-32" value={resolution} onChange={(event) => setResolution(event.target.value)} />
              </Label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>انصراف</Button>
              <Button onClick={() => void save()} loading={saving} disabled={resolution.trim().length < 3}>ثبت پاسخ</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
