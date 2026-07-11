"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Save, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const steps = ["اطلاعات پایه", "فرمت و ظرفیت", "پرداخت", "قوانین و زمان", "انتشار"];
type Option = { id: number; title: string };
type TemplateItem = { id: number | string; game_id: number; title: string; configuration: Record<string, unknown> | string };

type FormState = {
  title: string;
  slug: string;
  description: string;
  gameId: number;
  templateId: number | null;
  venueId: number | null;
  format: string;
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
  capacity: number;
  price: number;
  reservationExpiresMin: number;
  startsAt: string;
  lateToleranceMin: number;
  waitlistMode: "offer" | "manual" | "automatic";
  allowMultiSlot: boolean;
  hasThirdPlace: boolean;
  drawMode: "random" | "seeded" | "custom";
  rulesText: string;
  status: "DRAFT" | "PUBLISHED" | "REGISTRATION_OPEN";
};

function defaultStartDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const initialForm: FormState = {
  title: "",
  slug: `tournament-${Date.now()}`,
  description: "",
  gameId: 1,
  templateId: null,
  venueId: 1,
  format: "حذفی تک‌بازی",
  participantType: "INDIVIDUAL",
  teamSize: 1,
  capacity: 32,
  price: 350000,
  reservationExpiresMin: 30,
  startsAt: defaultStartDate(),
  lateToleranceMin: 10,
  waitlistMode: "offer",
  allowMultiSlot: true,
  hasThirdPlace: false,
  drawMode: "random",
  rulesText: "",
  status: "REGISTRATION_OPEN"
};

export function TournamentBuilder() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [games, setGames] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tournament-options", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/templates", { cache: "no-store" }).then((response) => response.json())
    ]).then(([options, templatePayload]) => {
      setGames(options.games || []);
      setVenues(options.venues || []);
      setTemplates(templatePayload.items || []);
    }).catch(() => setError("دریافت تنظیمات اولیه انجام نشد."));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectTemplate(value: string) {
    if (!value) {
      update("templateId", null);
      return;
    }
    const selected = templates.find((item) => String(item.id) === value);
    if (!selected) return;
    const config = typeof selected.configuration === "string" ? JSON.parse(selected.configuration) : selected.configuration;
    setForm((current) => ({
      ...current,
      templateId: Number(selected.id),
      gameId: Number(selected.game_id),
      format: String(config.format || current.format),
      capacity: Number(config.capacity || current.capacity),
      teamSize: Number(config.teamSize || current.teamSize),
      participantType: Number(config.teamSize || 1) > 1 ? "TEAM" : current.participantType,
      lateToleranceMin: Number(config.lateToleranceMin ?? current.lateToleranceMin),
      drawMode: ["random","seeded","custom"].includes(String(config.drawMode)) ? String(config.drawMode) as FormState["drawMode"] : current.drawMode
    }));
  }

  const canNext = useMemo(() => {
    if (step === 0) return form.title.trim().length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug);
    if (step === 1) return form.capacity >= 2 && (form.participantType === "INDIVIDUAL" || form.teamSize >= 2);
    if (step === 2) return form.price >= 0 && form.reservationExpiresMin >= 5;
    if (step === 3) return Boolean(form.startsAt);
    return true;
  }, [form, step]);

  async function save() {
    setSaving(true);
    setError("");
    setSavedSlug("");
    try {
      const rules = form.rulesText.split("\n").map((rule) => rule.trim()).filter(Boolean);
      const payload = {
        title: form.title,
        slug: form.slug,
        description: form.description,
        gameId: form.gameId,
        templateId: form.templateId,
        venueId: form.venueId,
        format: form.format,
        participantType: form.participantType,
        teamSize: form.participantType === "TEAM" ? form.teamSize : 1,
        capacity: form.capacity,
        price: form.price,
        startsAt: new Date(form.startsAt).toISOString(),
        reservationExpiresMin: form.reservationExpiresMin,
        lateToleranceMin: form.lateToleranceMin,
        waitlistMode: form.waitlistMode,
        allowMultiSlot: form.allowMultiSlot,
        hasThirdPlace: form.hasThirdPlace,
        drawMode: form.drawMode,
        rules,
        status: form.status
      };
      const response = await fetch("/api/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ذخیره مسابقه انجام نشد.");

      if (saveAsTemplate) {
        const templateResponse = await fetch("/api/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `قالب ${form.title}`,
            gameId: form.gameId,
            description: form.description.slice(0, 500),
            configuration: {
              format: form.format,
              participantType: form.participantType,
              teamSize: form.participantType === "TEAM" ? form.teamSize : 1,
              capacity: form.capacity,
              price: form.price,
              reservationExpiresMin: form.reservationExpiresMin,
              lateToleranceMin: form.lateToleranceMin,
              waitlistMode: form.waitlistMode,
              allowMultiSlot: form.allowMultiSlot,
              hasThirdPlace: form.hasThirdPlace,
              drawMode: form.drawMode,
              rules
            }
          })
        });
        if (!templateResponse.ok) {
          const templateError = await templateResponse.json();
          throw new Error(`مسابقه ذخیره شد، اما قالب ذخیره نشد: ${templateError.message || "خطا"}`);
        }
      }
      setSavedSlug(result.slug || form.slug);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ذخیره مسابقه انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <div className="mb-7 overflow-x-auto">
      <div className="flex min-w-[680px] items-center">
        {steps.map((label, index) => <div key={label} className="flex flex-1 items-center">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-black ${index <= step ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>{index < step ? <Check size={17}/> : index + 1}</span>
          <span className={`mr-2 text-xs font-bold ${index <= step ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{label}</span>
          {index < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-[var(--line)]"/>}
        </div>)}
      </div>
    </div>

    <Card className="p-6 sm:p-8">
      {step === 0 && <div className="grid gap-5 sm:grid-cols-2">
        <Label className="sm:col-span-2">استفاده از قالب ذخیره‌شده<SelectField value={form.templateId ? String(form.templateId) : "none"} onValueChange={(value) => selectTemplate(value === "none" ? "" : value)} options={[{ value: "none", label: "بدون قالب" }, ...templates.map((item) => ({ value: String(item.id), label: item.title }))]} /></Label>
        <Label>عنوان مسابقه<Input value={form.title} onChange={(event) => update("title", event.target.value)} /></Label>
        <Label>Slug انگلیسی<Input dir="ltr" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></Label>
        <Label>بازی<SelectField value={String(form.gameId)} onValueChange={(value) => update("gameId", Number(value))} options={games.map((game) => ({ value: String(game.id), label: game.title }))} /></Label>
        <Label>محل<SelectField value={form.venueId ? String(form.venueId) : "none"} onValueChange={(value) => update("venueId", value === "none" ? null : Number(value))} options={[{ value: "none", label: "بدون محل" }, ...venues.map((venue) => ({ value: String(venue.id), label: venue.title }))]} /></Label>
        <Label className="sm:col-span-2">توضیحات<Textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></Label>
      </div>}

      {step === 1 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>فرمت<SelectField value={form.format} onValueChange={(value) => update("format", value)} options={["حذفی تک‌بازی", "حذفی رفت‌وبرگشت", "دوحذفی", "گروهی و سپس حذفی", "لیگ دوره‌ای", "Swiss System"].map((value) => ({ value, label: value }))} /></Label>
        <Label>نوع شرکت<SelectField value={form.participantType} onValueChange={(value) => update("participantType", value as FormState["participantType"])} options={[{ value: "INDIVIDUAL", label: "انفرادی" }, { value: "TEAM", label: "تیمی" }]} /></Label>
        {form.participantType === "TEAM" && <Label>تعداد اعضای تیم<Input type="number" min="2" max="10" value={form.teamSize} onChange={(event) => update("teamSize", Number(event.target.value))} /></Label>}
        <Label>ظرفیت سهم/تیم<Input type="number" min="2" value={form.capacity} onChange={(event) => update("capacity", Number(event.target.value))} /></Label>
        <Label>نوع قرعه<SelectField value={form.drawMode} onValueChange={(value) => update("drawMode", value as FormState["drawMode"])} options={[{ value: "random", label: "تصادفی" }, { value: "seeded", label: "Seed شده" }, { value: "custom", label: "دستی" }]} /></Label>
        <Label>مسابقه رده‌بندی<SelectField value={form.hasThirdPlace ? "yes" : "no"} onValueChange={(value) => update("hasThirdPlace", value === "yes")} options={[{ value: "yes", label: "فعال" }, { value: "no", label: "غیرفعال" }]} /></Label>
        <Label>خرید چند سهم<SelectField value={form.allowMultiSlot ? "yes" : "no"} onValueChange={(value) => update("allowMultiSlot", value === "yes")} options={[{ value: "yes", label: "فعال" }, { value: "no", label: "غیرفعال" }]} /></Label>
      </div>}

      {step === 2 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>هزینه هر سهم (تومان)<Input type="number" min="0" value={form.price} onChange={(event) => update("price", Number(event.target.value))} /></Label>
        <Label>مهلت رزرو بدون پرداخت (دقیقه)<Input type="number" min="5" value={form.reservationExpiresMin} onChange={(event) => update("reservationExpiresMin", Number(event.target.value))} /></Label>
        <Alert tone="info" className="sm:col-span-2">روش‌های پرداخت فعال پروژه شامل درگاه Mock، پرداخت حضوری و فیش بانکی است. تنظیم سرویس واقعی از فایل env انجام می‌شود.</Alert>
      </div>}

      {step === 3 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>شروع مسابقه<Input type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></Label>
        <Label>مهلت تاخیر (دقیقه)<Input type="number" min="0" value={form.lateToleranceMin} onChange={(event) => update("lateToleranceMin", Number(event.target.value))} /></Label>
        <Label>جایگزینی لیست انتظار<SelectField value={form.waitlistMode} onValueChange={(value) => update("waitlistMode", value as FormState["waitlistMode"])} options={[{ value: "offer", label: "پیشنهاد با مهلت پاسخ" }, { value: "manual", label: "دستی" }, { value: "automatic", label: "خودکار" }]} /></Label>
        <Label className="sm:col-span-2">قوانین؛ هر قانون در یک خط<Textarea className="min-h-40" value={form.rulesText} onChange={(event) => update("rulesText", event.target.value)} /></Label>
      </div>}

      {step === 4 && <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/12 text-emerald-500"><Sparkles size={30}/></span>
        <h2 className="mt-5 text-2xl font-black">مسابقه آماده ذخیره است</h2>
        <Label className="mx-auto mt-6 max-w-sm text-right">وضعیت اولیه<SelectField value={form.status} onValueChange={(value) => update("status", value as FormState["status"])} options={[{ value: "DRAFT", label: "پیش‌نویس" }, { value: "PUBLISHED", label: "منتشرشده" }, { value: "REGISTRATION_OPEN", label: "ثبت‌نام باز" }]} /></Label>
        <div className="mx-auto mt-4 flex max-w-sm items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm font-bold"><span>ذخیره تنظیمات به‌عنوان قالب</span><Switch checked={saveAsTemplate} onCheckedChange={setSaveAsTemplate} aria-label="ذخیره به عنوان قالب" /></div>
        {savedSlug && <Alert tone="success" className="mx-auto mt-5 max-w-xl justify-center">مسابقه ذخیره شد. <a className="underline" href={`/tournaments/${savedSlug}`}>مشاهده صفحه مسابقه</a></Alert>}
      </div>}

      {error && <Alert tone="error" className="mt-6">{error}</Alert>}

      <div className="mt-8 flex justify-between border-t border-[var(--line)] pt-6">
        <Button type="button" variant="secondary" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}><ChevronRight size={17}/>قبلی</Button>
        {step < steps.length - 1 ? <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>مرحله بعد<ChevronLeft size={17}/></Button> : <Button type="button" disabled={Boolean(savedSlug)} onClick={save} loading={saving} loadingText="در حال ذخیره"><Save size={17}/>ذخیره مسابقه</Button>}
      </div>
    </Card>
  </div>;
}
