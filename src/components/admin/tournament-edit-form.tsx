"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { FieldHint, Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  TOURNAMENT_FORMATS,
  getTournamentStatusLabel,
  getTournamentStatusOptions,
  openRegistrationStatusError,
  type TournamentFormat,
  type TournamentStatus
} from "@/lib/tournament-definition";

type Option = { id: number; title: string };

type Form = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  gameId: number;
  templateId: number | null;
  venueId: number | null;
  format: TournamentFormat;
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
  capacity: number;
  minParticipants: number;
  price: number;
  status: TournamentStatus;
  registrationStartsAt: string;
  registrationEndsAt: string;
  startsAt: string;
  endsAt: string;
  reservationExpiresMin: number;
  lateToleranceMin: number;
  waitlistMode: "disabled" | "offer" | "manual" | "automatic";
  allowMultiSlot: boolean;
  hasThirdPlace: boolean;
  drawMode: "random" | "seeded" | "custom";
  rulesText: string;
  gameSettingsText: string;
  scoringSettingsText: string;
  notificationSettingsText: string;
  cancellationSettingsText: string;
  prizeSettingsText: string;
  coverImageUrl: string;
  isFeatured: boolean;
};

type EditMeta = {
  registrationCount: number;
  activeRegistrationCount: number;
  matchCount: number;
  holdCount: number;
  waitlistCount: number;
  occupied: number;
};

function parseObject(text: string, label: string) {
  try {
    const value = JSON.parse(text || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw new Error(`${label} باید JSON Object معتبر باشد.`);
  }
}

function iso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function TournamentEditForm({
  initial,
  games,
  venues,
  templates,
  meta
}: {
  initial: Form;
  games: Option[];
  venues: Option[];
  templates: Option[];
  meta: EditMeta;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const structuralLocked = meta.registrationCount > 0
    || meta.matchCount > 0
    || meta.holdCount > 0
    || meta.waitlistCount > 0;
  const drawLocked = meta.matchCount > 0;
  const scheduleLocked = meta.matchCount > 0;
  const hasActiveData = meta.activeRegistrationCount > 0
    || meta.matchCount > 0
    || meta.holdCount > 0
    || meta.waitlistCount > 0;

  const statusOptions = useMemo(() => {
    return getTournamentStatusOptions(initial.status).map((option) => ({
      ...option,
      disabled: option.value === "CANCELLED" && initial.status !== "CANCELLED" && hasActiveData
    }));
  }, [hasActiveData, initial.status]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (form.title.trim().length < 3) return "عنوان مسابقه حداقل سه حرف باشد.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) return "Slug فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.";
    if (form.participantType === "TEAM" && form.teamSize < 2) return "مسابقه تیمی حداقل دو عضو در هر تیم نیاز دارد.";
    if (form.capacity < meta.occupied) return `ظرفیت کمتر از ظرفیت اشغال‌شده (${meta.occupied.toLocaleString("fa-IR")}) است.`;
    if (form.minParticipants > form.capacity) return "حداقل شرکت‌کننده نمی‌تواند بیشتر از ظرفیت باشد.";
    if (!form.startsAt) return "زمان شروع مسابقه الزامی است.";

    const start = new Date(form.startsAt).getTime();
    const end = form.endsAt ? new Date(form.endsAt).getTime() : null;
    const registrationStart = form.registrationStartsAt ? new Date(form.registrationStartsAt).getTime() : null;
    const registrationEnd = form.registrationEndsAt ? new Date(form.registrationEndsAt).getTime() : null;
    if ((registrationStart === null) !== (registrationEnd === null)) return "شروع و پایان ثبت‌نام را هر دو تعیین کنید.";
    if (registrationStart !== null && registrationEnd !== null) {
      if (registrationStart >= registrationEnd) return "پایان ثبت‌نام باید بعد از شروع آن باشد.";
      if (registrationEnd >= start) return "پایان ثبت‌نام باید قبل از شروع مسابقه باشد.";
    }
    if (end !== null && end <= start) return "پایان مسابقه باید بعد از شروع آن باشد.";

    if (initial.status !== form.status && form.status === "REGISTRATION_OPEN") {
      return openRegistrationStatusError({
        registrationStartsAt: iso(form.registrationStartsAt),
        registrationEndsAt: iso(form.registrationEndsAt),
        startsAt: new Date(form.startsAt).toISOString()
      });
    }
    return null;
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const validationError = validate();
      if (validationError) throw new Error(validationError);

      const payload = {
        title: form.title,
        slug: form.slug,
        subtitle: form.subtitle || undefined,
        description: form.description || undefined,
        gameId: form.gameId,
        templateId: form.templateId,
        venueId: form.venueId,
        format: form.format,
        participantType: form.participantType,
        teamSize: form.participantType === "TEAM" ? form.teamSize : 1,
        capacity: form.capacity,
        minParticipants: form.minParticipants,
        price: form.price,
        status: form.status,
        registrationStartsAt: iso(form.registrationStartsAt),
        registrationEndsAt: iso(form.registrationEndsAt),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: iso(form.endsAt),
        reservationExpiresMin: form.reservationExpiresMin,
        lateToleranceMin: form.lateToleranceMin,
        waitlistMode: form.waitlistMode,
        allowMultiSlot: form.allowMultiSlot,
        hasThirdPlace: form.hasThirdPlace,
        drawMode: form.drawMode,
        rules: form.rulesText.split("\n").map((value) => value.trim()).filter(Boolean),
        gameSettings: parseObject(form.gameSettingsText, "تنظیمات بازی"),
        scoringSettings: parseObject(form.scoringSettingsText, "تنظیمات امتیاز"),
        notificationSettings: parseObject(form.notificationSettingsText, "تنظیمات اعلان"),
        cancellationSettings: parseObject(form.cancellationSettingsText, "تنظیمات لغو"),
        prizeSettings: parseObject(form.prizeSettingsText, "تنظیمات جایزه"),
        coverImageUrl: form.coverImageUrl || null,
        isFeatured: form.isFeatured
      };

      const response = await fetch(`/api/tournaments/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ویرایش انجام نشد.");

      setMessage("تغییرات مسابقه ذخیره شد.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ویرایش انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-7 space-y-5">
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div><span className="text-xs text-[var(--muted)]">وضعیت فعلی</span><strong className="mt-1 block text-sm">{getTournamentStatusLabel(initial.status)}</strong></div>
        <div><span className="text-xs text-[var(--muted)]">ثبت‌نام‌ها</span><strong className="mt-1 block">{meta.registrationCount.toLocaleString("fa-IR")}</strong></div>
        <div><span className="text-xs text-[var(--muted)]">ظرفیت اشغال‌شده</span><strong className="mt-1 block">{meta.occupied.toLocaleString("fa-IR")}</strong></div>
        <div><span className="text-xs text-[var(--muted)]">بازی‌ها</span><strong className="mt-1 block">{meta.matchCount.toLocaleString("fa-IR")}</strong></div>
        <div><span className="text-xs text-[var(--muted)]">رزرو موقت</span><strong className="mt-1 block">{meta.holdCount.toLocaleString("fa-IR")}</strong></div>
        <div><span className="text-xs text-[var(--muted)]">صف انتظار</span><strong className="mt-1 block">{meta.waitlistCount.toLocaleString("fa-IR")}</strong></div>
      </div>
    </Card>

    {structuralLocked && <Alert tone="info"><LockKeyhole size={17} />چون برای این مسابقه داده عملیاتی ایجاد شده، بازی، فرمت و نوع شرکت‌کننده قفل هستند. ظرفیت فقط تا مقدار اشغال‌شده قابل کاهش است.</Alert>}

    <Card className="p-6">
      <section>
        <h2 className="text-lg font-black">اطلاعات اصلی</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Label>عنوان<Input value={form.title} onChange={(event) => update("title", event.target.value)} /></Label>
          <Label>Slug<Input dir="ltr" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} /></Label>
          <Label>زیرعنوان<Input value={form.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></Label>
          <Label>بازی<SelectField disabled={structuralLocked} value={String(form.gameId)} onValueChange={(value) => update("gameId", Number(value))} options={games.map((item) => ({ value: String(item.id), label: item.title }))} /></Label>
          <Label>قالب<SelectField value={form.templateId ? String(form.templateId) : "none"} onValueChange={(value) => update("templateId", value === "none" ? null : Number(value))} options={[{ value: "none", label: "بدون قالب" }, ...templates.map((item) => ({ value: String(item.id), label: item.title }))]} /></Label>
          <Label>محل<SelectField disabled={scheduleLocked} value={form.venueId ? String(form.venueId) : "none"} onValueChange={(value) => update("venueId", value === "none" ? null : Number(value))} options={[{ value: "none", label: "اعلام بعدی" }, ...venues.map((item) => ({ value: String(item.id), label: item.title }))]} /></Label>
          <Label className="md:col-span-2">توضیحات<Textarea className="min-h-32" value={form.description} onChange={(event) => update("description", event.target.value)} /></Label>
        </div>
      </section>

      <section className="mt-8 border-t border-[var(--line)] pt-8">
        <h2 className="text-lg font-black">ساختار و ظرفیت</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Label>فرمت<SelectField disabled={structuralLocked} value={form.format} onValueChange={(value) => update("format", value as TournamentFormat)} options={TOURNAMENT_FORMATS.map((value) => ({ value, label: value }))} /></Label>
          <Label>نوع شرکت‌کننده<SelectField disabled={structuralLocked} value={form.participantType} onValueChange={(value) => setForm((current) => ({ ...current, participantType: value as Form["participantType"], teamSize: value === "INDIVIDUAL" ? 1 : Math.max(2, current.teamSize) }))} options={[{ value: "INDIVIDUAL", label: "انفرادی" }, { value: "TEAM", label: "تیمی" }]} /></Label>
          {form.participantType === "TEAM" && <Label>تعداد اعضای تیم<Input disabled={structuralLocked} type="number" min="2" max="20" value={form.teamSize} onChange={(event) => update("teamSize", Number(event.target.value))} /></Label>}
          <Label>
            ظرفیت کل
            <Input type="number" min={Math.max(2, meta.occupied)} value={form.capacity} onChange={(event) => update("capacity", Number(event.target.value))} />
            <FieldHint>حداقل مجاز فعلی: {Math.max(2, meta.occupied).toLocaleString("fa-IR")}</FieldHint>
          </Label>
          <Label>حداقل نفر برای برگزاری<Input type="number" min="2" max={form.capacity} value={form.minParticipants} onChange={(event) => update("minParticipants", Number(event.target.value))} /></Label>
          <Label>نوع قرعه<SelectField disabled={drawLocked} value={form.drawMode} onValueChange={(value) => update("drawMode", value as Form["drawMode"])} options={[{ value: "random", label: "تصادفی" }, { value: "seeded", label: "Seed بندی" }, { value: "custom", label: "دستی" }]} /></Label>
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4"><span>مسابقه رده‌بندی</span><Switch disabled={drawLocked} checked={form.hasThirdPlace} onCheckedChange={(value) => update("hasThirdPlace", value)} /></div>
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4"><span>خرید چند سهم</span><Switch checked={form.allowMultiSlot} onCheckedChange={(value) => update("allowMultiSlot", value)} /></div>
        </div>
      </section>

      <section className="mt-8 border-t border-[var(--line)] pt-8">
        <h2 className="text-lg font-black">ثبت‌نام، زمان و وضعیت</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Label>شروع ثبت‌نام<PersianDatePicker mode="datetime" value={form.registrationStartsAt} onChange={(value) => update("registrationStartsAt", value)} /></Label>
          <Label>پایان ثبت‌نام<PersianDatePicker mode="datetime" value={form.registrationEndsAt} onChange={(value) => update("registrationEndsAt", value)} /></Label>
          <Label>شروع مسابقه<PersianDatePicker disabled={scheduleLocked} mode="datetime" value={form.startsAt} onChange={(value) => update("startsAt", value)} required /></Label>
          <Label>پایان تقریبی مسابقه<PersianDatePicker mode="datetime" value={form.endsAt} onChange={(value) => update("endsAt", value)} /></Label>
          <Label>هزینه (تومان)<Input type="number" min="0" value={form.price} onChange={(event) => update("price", Number(event.target.value))} /></Label>
          <Label>مهلت رزرو بدون پرداخت (دقیقه)<Input type="number" min="5" max="1440" value={form.reservationExpiresMin} onChange={(event) => update("reservationExpiresMin", Number(event.target.value))} /></Label>
          <Label>مهلت تأخیر (دقیقه)<Input type="number" min="0" max="180" value={form.lateToleranceMin} onChange={(event) => update("lateToleranceMin", Number(event.target.value))} /></Label>
          <Label>صف انتظار<SelectField value={form.waitlistMode} onValueChange={(value) => update("waitlistMode", value as Form["waitlistMode"])} options={[{ value: "disabled", label: "غیرفعال" }, { value: "offer", label: "پیشنهاد با مهلت" }, { value: "manual", label: "مدیریت دستی" }, { value: "automatic", label: "خودکار" }]} /></Label>
          <Label>
            وضعیت
            <SelectField value={form.status} onValueChange={(value) => update("status", value as TournamentStatus)} options={statusOptions} />
            <FieldHint>قرعه آماده، در حال برگزاری و پایان‌یافته توسط خود سیستم تعیین می‌شوند.</FieldHint>
          </Label>
          <Label>تصویر یا گرادیان کاور<Input value={form.coverImageUrl} onChange={(event) => update("coverImageUrl", event.target.value)} /></Label>
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4"><span>نمایش ویژه</span><Switch checked={form.isFeatured} onCheckedChange={(value) => update("isFeatured", value)} /></div>
        </div>
      </section>

      <section className="mt-8 border-t border-[var(--line)] pt-8">
        <h2 className="text-lg font-black">قوانین</h2>
        <Label className="mt-5">هر خط یک قانون<Textarea className="min-h-40" value={form.rulesText} onChange={(event) => update("rulesText", event.target.value)} /></Label>
      </section>

      <details className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-5">
        <summary className="cursor-pointer font-black">تنظیمات پیشرفته JSON</summary>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">این بخش برای تنظیمات تخصصی موتور مسابقه است. اگر مطمئن نیستید، مقادیر فعلی را تغییر ندهید.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {([
            ["gameSettingsText", "تنظیمات بازی"],
            ["scoringSettingsText", "تنظیمات امتیاز"],
            ["notificationSettingsText", "تنظیمات اعلان"],
            ["cancellationSettingsText", "تنظیمات لغو"],
            ["prizeSettingsText", "تنظیمات جوایز"]
          ] as const).map(([key, label]) => <Label key={key}>{label}<Textarea dir="ltr" value={form[key]} onChange={(event) => update(key, event.target.value)} /></Label>)}
        </div>
      </details>

      {error && <Alert tone="error" className="mt-5">{error}</Alert>}
      {message && <Alert tone="success" className="mt-5">{message}</Alert>}
      <Button className="mt-6" type="button" onClick={save} loading={saving} loadingText="در حال ذخیره"><Save size={17} />ذخیره تغییرات</Button>
    </Card>
  </div>;
}
