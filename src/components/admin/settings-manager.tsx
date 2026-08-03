"use client";

import { useEffect, useState } from "react";
import { Gauge, Save, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  club: { name: string; phone: string; address: string };
  auth: { admin2fa: "optional" | "required"; sessionDays: number };
  otp: { ttlMinutes: number; cooldownSeconds: number; hourlyLimit: number; ipHourlyLimit: number; maxAttempts: number };
  registration: { holdMinutes: number; correctionHours: number; waitlistOfferMinutes: number };
  home: { tournamentsLimit: number; liveMatchesLimit: number };
  payment: { cash: boolean; pos: boolean; receipt: boolean; partial: boolean };
  notification: { inApp: boolean; email: boolean; sms: "disabled" | "optional" | "required" };
};

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm font-bold"><span>{label}</span><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} /></div>;
}

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

  return <>
    <div className="mt-7 grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="font-black">اطلاعات مجموعه</h2>
        <div className="mt-5 grid gap-4">
          <Label>نام مجموعه<Input value={settings.club.name} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, name: event.target.value } })} /></Label>
          <Label>شماره تماس<Input dir="ltr" value={settings.club.phone} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, phone: event.target.value } })} /></Label>
          <Label>آدرس<Textarea value={settings.club.address} onChange={(event) => setSettings({ ...settings, club: { ...settings.club, address: event.target.value } })} /></Label>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-black"><Gauge className="text-[var(--brand)]" />نمایش صفحه اصلی</h2>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">تعداد کارت‌هایی که در صفحه اصلی نمایش داده می‌شوند. مقدار کمتر، صفحه سبک‌تر و سریع‌تر می‌سازد.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Label>تعداد مسابقات<Input type="number" min="1" max="12" value={settings.home.tournamentsLimit} onChange={(event) => setSettings({ ...settings, home: { ...settings.home, tournamentsLimit: Number(event.target.value) } })} /></Label>
          <Label>تعداد نتایج زنده<Input type="number" min="1" max="12" value={settings.home.liveMatchesLimit} onChange={(event) => setSettings({ ...settings, home: { ...settings.home, liveMatchesLimit: Number(event.target.value) } })} /></Label>
        </div>
      </Card>
      <Card className="p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 font-black"><ShieldCheck className="text-[var(--brand)]" />امنیت و سرویس‌ها</h2>
        <div className="mt-5 grid gap-4">
          <Label>ورود دومرحله‌ای مدیر<SelectField value={settings.auth.admin2fa} onValueChange={(value) => setSettings({ ...settings, auth: { ...settings.auth, admin2fa: value as Settings["auth"]["admin2fa"] } })} options={[{ value: "optional", label: "اختیاری" }, { value: "required", label: "اجباری" }]} /></Label>
          <Label>اعتبار نشست (روز)<Input type="number" min="1" max="90" value={settings.auth.sessionDays} onChange={(event) => setSettings({ ...settings, auth: { ...settings.auth, sessionDays: Number(event.target.value) } })} /></Label>
          <div className="grid grid-cols-2 gap-3"><Label>مهلت Hold (دقیقه)<Input type="number" min="5" max="120" value={settings.registration.holdMinutes} onChange={(event) => setSettings({ ...settings, registration: { ...settings.registration, holdMinutes: Number(event.target.value) } })} /></Label><Label>مهلت اصلاح (ساعت)<Input type="number" min="1" max="168" value={settings.registration.correctionHours} onChange={(event) => setSettings({ ...settings, registration: { ...settings.registration, correctionHours: Number(event.target.value) } })} /></Label><Label>مهلت پیشنهاد صف (دقیقه)<Input type="number" min="5" max="1440" value={settings.registration.waitlistOfferMinutes} onChange={(event) => setSettings({ ...settings, registration: { ...settings.registration, waitlistOfferMinutes: Number(event.target.value) } })} /></Label><Label>اعتبار OTP (دقیقه)<Input type="number" min="2" max="30" value={settings.otp.ttlMinutes} onChange={(event) => setSettings({ ...settings, otp: { ...settings.otp, ttlMinutes: Number(event.target.value) } })} /></Label></div>
          <ToggleRow label="پرداخت نقدی حضوری" checked={settings.payment.cash} onCheckedChange={(checked) => setSettings({ ...settings, payment: { ...settings.payment, cash: checked } })} />
          <ToggleRow label="پرداخت با کارتخوان حضوری" checked={settings.payment.pos} onCheckedChange={(checked) => setSettings({ ...settings, payment: { ...settings.payment, pos: checked } })} />
          <ToggleRow label="انتقال بانکی و رسید اختیاری" checked={settings.payment.receipt} onCheckedChange={(checked) => setSettings({ ...settings, payment: { ...settings.payment, receipt: checked } })} />
          <ToggleRow label="اعلان داخل برنامه" checked={settings.notification.inApp} onCheckedChange={(checked) => setSettings({ ...settings, notification: { ...settings.notification, inApp: checked } })} />
          <ToggleRow label="اعلان ایمیلی" checked={settings.notification.email} onCheckedChange={(checked) => setSettings({ ...settings, notification: { ...settings.notification, email: checked } })} />
          <Label>سیاست پیامک<SelectField value={settings.notification.sms} onValueChange={(value) => setSettings({ ...settings, notification: { ...settings.notification, sms: value as Settings["notification"]["sms"] } })} options={[{value:"disabled",label:"غیرفعال"},{value:"optional",label:"اختیاری"},{value:"required",label:"اجباری"}]} /></Label>
          <Alert tone="warning" className="text-xs font-normal">کلیدهای SMS.ir فقط از فایل env سرور خوانده می‌شوند. فعال‌بودن اعلان داخل برنامه و روش‌های پرداخت از این بخش مدیریت می‌شود.</Alert>
        </div>
      </Card>
    </div>
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    {message && <Alert tone="success" className="mt-4">{message}</Alert>}
    <Button className="mt-5" type="button" onClick={save} loading={saving} loadingText="در حال ذخیره"><Save size={16} />ذخیره تنظیمات</Button>
  </>;
}
