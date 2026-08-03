/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type WaitlistItem = {
  id: number | string;
  status: string;
  position: number;
  current_position?: number;
  slots: number;
  amount: number;
  offer_token?: string | null;
  offer_expires_at?: string | null;
  tournament_title: string;
  slug: string;
  tournament_id: number | string;
};

const statusLabels: Record<string, string> = {
  WAITING: "در صف",
  OFFERED: "ظرفیت پیشنهادی",
  CONVERTED: "تبدیل به رزرو",
  EXPIRED: "منقضی",
  DECLINED: "ردشده",
  CANCELLED: "لغوشده"
};

export function WaitlistManager() {
  const [items, setItems] = useState<WaitlistItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/waitlist", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.message || "دریافت صف انتظار انجام نشد.");
      return;
    }

    setItems(payload.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(
    item: WaitlistItem,
    action: "accept" | "cancel" | "decline"
  ) {
    setError("");
    setMessage("");
    setActionId(String(item.id));

    try {
      const response = await fetch(`/api/waitlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          offerToken: item.offer_token || undefined
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message || "عملیات انجام نشد.");
        return;
      }

      if (action === "accept" && payload.holdToken) {
        sessionStorage.setItem(
          `cgs-registration-hold-${item.tournament_id}`,
          JSON.stringify({ token: payload.holdToken, expiresAt: payload.expiresAt })
        );
        setMessage("ظرفیت برای شما رزرو شد؛ وارد صفحه مسابقه شوید و ثبت‌نام را تکمیل کنید.");
      }

      await load();
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      {message && <Alert tone="success" className="mt-4">{message}</Alert>}

      <div className="mt-7 grid gap-4">
        {items.map((item) => {
          const busy = actionId === String(item.id);
          const currentPosition = Number(item.current_position || item.position);

          return (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong>{item.tournament_title}</strong>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.status === "WAITING"
                      ? `موقعیت فعلی صف: ${currentPosition.toLocaleString("fa-IR")}`
                      : `شماره اولیه صف: ${Number(item.position).toLocaleString("fa-IR")}`}
                    {` · ${Number(item.slots).toLocaleString("fa-IR")} سهم`}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold">
                  {statusLabels[item.status] || item.status}
                </span>
              </div>

              {item.status === "OFFERED" && (
                <Alert tone="success" className="mt-4">
                  ظرفیت آزاد شده است. تا {item.offer_expires_at
                    ? new Intl.DateTimeFormat("fa-IR", {
                        dateStyle: "short",
                        timeStyle: "short"
                      }).format(new Date(item.offer_expires_at))
                    : "پایان مهلت"} پیشنهاد را بپذیرید.
                </Alert>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {item.status === "OFFERED" && (
                  <>
                    <Button
                      size="sm"
                      loading={busy}
                      onClick={() => runAction(item, "accept")}
                    >
                      پذیرش و رزرو
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => runAction(item, "decline")}
                    >
                      رد پیشنهاد
                    </Button>
                  </>
                )}
                {item.status === "WAITING" && (
                  <Button
                    size="sm"
                    variant="dangerSoft"
                    loading={busy}
                    onClick={() => runAction(item, "cancel")}
                  >
                    خروج از صف
                  </Button>
                )}
                <Button href={`/tournaments/${item.slug}`} size="sm" variant="ghost">
                  مشاهده مسابقه
                </Button>
              </div>
            </Card>
          );
        })}

        {!loading && !items.length && (
          <Card className="p-8 text-center text-[var(--muted)]">
            در صف انتظار مسابقه‌ای نیستید.
          </Card>
        )}
      </div>
    </>
  );
}
