"use client";

import { useEffect, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Settings = {
  club: { name: string; phone: string; address: string };
  auth: { admin2fa: "optional" | "required" };
  payment: { cash: boolean; receipt: boolean; partial: boolean };
  notification: { inApp: boolean; email: boolean; sms: "disabled" | "optional" | "required" };
};

export function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" }).then(async (response) => ({ response, payload: await response.json() })).then(({ response, payload }) => {
      if (!response.ok) return setError(payload.message || "دریافت تنظیمات انجام نشد.");
      setSettings(payload.item);
    }).catch(() => setError("دریافت تنظیمات انجام نشد."));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setError(payload.message || "ذخیره تنظیمات انجام نشد.");
    setMessage("تنظیمات ذخیره شد.");
  }

  if (!settings) return <p className="mt-7 text-sm text-[var(--muted)]">{error || "در حال دریافت تنظیمات..."}</p>;
  return <><div className="mt-7 grid gap-6 lg:grid-cols-2"><Card className="p-6"><h2 className="font-black">اطلاعات مجموعه</h2><div className="mt-5 grid gap-4"><label className="field-label">نام مجموعه<input className="field" value={settings.club.name} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, name: event.target.value } })}/></label><label className="field-label">شماره تماس<input className="field" dir="ltr" value={settings.club.phone} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, phone: event.target.value } })}/></label><label className="field-label">آدرس<textarea className="field" value={settings.club.address} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, address: event.target.value } })}/></label></div></Card><Card className="p-6"><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="text-[var(--brand)]"/>امنیت و سرویس‌ها</h2><div className="mt-5 grid gap-4"><label className="field-label">ورود دومرحله‌ای مدیر<select className="field" value={settings.auth.admin2fa} onChange={(event) => setSettings({ ...settings, auth: { admin2fa: event.target.value as Settings["auth"]["admin2fa"] } })}><option value="optional">اختیاری</option><option value="required">اجباری</option></select></label><label className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-4 text-sm font-bold"><span>پرداخت حضوری</span><input type="checkbox" checked={settings.payment.cash} onChange={(event) => setSettings({ ...settings, payment: { ...settings.payment, cash: event.target.checked } })}/></label><label className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-4 text-sm font-bold"><span>آپلود فیش</span><input type="checkbox" checked={settings.payment.receipt} onChange={(event) => setSettings({ ...settings, payment: { ...settings.payment, receipt: event.target.checked } })}/></label><label className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-4 text-sm font-bold"><span>اعلان داخل برنامه</span><input type="checkbox" checked={settings.notification.inApp} onChange={(event) => setSettings({ ...settings, notification: { ...settings.notification, inApp: event.target.checked } })}/></label><p className="rounded-2xl bg-amber-500/10 p-4 text-xs leading-6 text-amber-600">کلیدهای SMS.ir و درگاه پرداخت فقط از فایل env سرور خوانده می‌شوند و در دیتابیس ذخیره نمی‌شوند.</p></div></Card></div>{error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}{message && <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600">{message}</p>}<Button className="mt-5" onClick={save} disabled={saving}><Save size={16}/>{saving ? "در حال ذخیره" : "ذخیره تنظیمات"}</Button></>;
}
