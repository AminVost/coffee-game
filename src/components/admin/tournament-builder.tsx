"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <div className="mb-7 overflow-x-auto"><div className="flex min-w-[680px] items-center">{steps.map((label, index) => <div key={label} className="flex flex-1 items-center"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-black ${index <= step ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>{index < step ? <Check size={17}/> : index + 1}</span><span className={`mr-2 text-xs font-bold ${index <= step ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{label}</span>{index < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-[var(--line)]"/>}</div>)}</div></div>
    <Card className="p-6 sm:p-8">
      {step === 0 && <div className="grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">استفاده از قالب ذخیره‌شده<select className="field" value={form.templateId || ""} onChange={(event) => selectTemplate(event.target.value)}><option value="">بدون قالب</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="field-label">عنوان مسابقه<input className="field" value={form.title} onChange={(event) => update("title", event.target.value)}/></label><label className="field-label">Slug انگلیسی<input className="field" dir="ltr" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}/></label><label className="field-label">بازی<select className="field" value={form.gameId} onChange={(event) => update("gameId", Number(event.target.value))}>{games.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label><label className="field-label">محل<select className="field" value={form.venueId || ""} onChange={(event) => update("venueId", event.target.value ? Number(event.target.value) : null)}><option value="">بدون محل</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.title}</option>)}</select></label><label className="field-label sm:col-span-2">توضیحات<textarea className="field" value={form.description} onChange={(event) => update("description", event.target.value)}/></label></div>}
      {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><label className="field-label">فرمت<select className="field" value={form.format} onChange={(event) => update("format", event.target.value)}><option>حذفی تک‌بازی</option><option>حذفی رفت‌وبرگشت</option><option>دوحذفی</option><option>گروهی و سپس حذفی</option><option>لیگ دوره‌ای</option><option>Swiss System</option></select></label><label className="field-label">نوع شرکت<select className="field" value={form.participantType} onChange={(event) => update("participantType", event.target.value as FormState["participantType"])}><option value="INDIVIDUAL">انفرادی</option><option value="TEAM">تیمی</option></select></label>{form.participantType === "TEAM" && <label className="field-label">تعداد اعضای تیم<input className="field" type="number" min="2" max="10" value={form.teamSize} onChange={(event) => update("teamSize", Number(event.target.value))}/></label>}<label className="field-label">ظرفیت سهم/تیم<input className="field" type="number" min="2" value={form.capacity} onChange={(event) => update("capacity", Number(event.target.value))}/></label><label className="field-label">نوع قرعه<select className="field" value={form.drawMode} onChange={(event) => update("drawMode", event.target.value as FormState["drawMode"])}><option value="random">تصادفی</option><option value="seeded">Seed شده</option><option value="custom">دستی</option></select></label><label className="field-label">مسابقه رده‌بندی<select className="field" value={form.hasThirdPlace ? "yes" : "no"} onChange={(event) => update("hasThirdPlace", event.target.value === "yes")}><option value="yes">فعال</option><option value="no">غیرفعال</option></select></label><label className="field-label">خرید چند سهم<select className="field" value={form.allowMultiSlot ? "yes" : "no"} onChange={(event) => update("allowMultiSlot", event.target.value === "yes")}><option value="yes">فعال</option><option value="no">غیرفعال</option></select></label></div>}
      {step === 2 && <div className="grid gap-5 sm:grid-cols-2"><label className="field-label">هزینه هر سهم (تومان)<input className="field" type="number" min="0" value={form.price} onChange={(event) => update("price", Number(event.target.value))}/></label><label className="field-label">مهلت رزرو بدون پرداخت (دقیقه)<input className="field" type="number" min="5" value={form.reservationExpiresMin} onChange={(event) => update("reservationExpiresMin", Number(event.target.value))}/></label><p className="sm:col-span-2 rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">روش‌های پرداخت فعال پروژه شامل درگاه Mock، پرداخت حضوری و فیش بانکی است. تنظیم سرویس واقعی از فایل env انجام می‌شود.</p></div>}
      {step === 3 && <div className="grid gap-5 sm:grid-cols-2"><label className="field-label">شروع مسابقه<input className="field" type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)}/></label><label className="field-label">مهلت تاخیر (دقیقه)<input className="field" type="number" min="0" value={form.lateToleranceMin} onChange={(event) => update("lateToleranceMin", Number(event.target.value))}/></label><label className="field-label">جایگزینی لیست انتظار<select className="field" value={form.waitlistMode} onChange={(event) => update("waitlistMode", event.target.value as FormState["waitlistMode"])}><option value="offer">پیشنهاد با مهلت پاسخ</option><option value="manual">دستی</option><option value="automatic">خودکار</option></select></label><label className="field-label sm:col-span-2">قوانین؛ هر قانون در یک خط<textarea className="field min-h-40" value={form.rulesText} onChange={(event) => update("rulesText", event.target.value)}/></label></div>}
      {step === 4 && <div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/12 text-emerald-500"><Sparkles size={30}/></span><h2 className="mt-5 text-2xl font-black">مسابقه آماده ذخیره است</h2><label className="mx-auto mt-6 block max-w-sm text-right field-label">وضعیت اولیه<select className="field" value={form.status} onChange={(event) => update("status", event.target.value as FormState["status"])}><option value="DRAFT">پیش‌نویس</option><option value="PUBLISHED">منتشرشده</option><option value="REGISTRATION_OPEN">ثبت‌نام باز</option></select></label><label className="mx-auto mt-4 flex max-w-sm items-center justify-between rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-bold"><span>ذخیره تنظیمات به‌عنوان قالب</span><input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)}/></label>{savedSlug && <p className="mt-5 rounded-xl bg-emerald-500/10 p-4 font-black text-emerald-600">مسابقه ذخیره شد. <a className="underline" href={`/tournaments/${savedSlug}`}>مشاهده صفحه مسابقه</a></p>}</div>}
      {error && <p className="mt-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      <div className="mt-8 flex justify-between border-t border-[var(--line)] pt-6"><Button variant="secondary" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}><ChevronRight size={17}/>قبلی</Button>{step < steps.length - 1 ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>مرحله بعد<ChevronLeft size={17}/></Button> : <Button disabled={saving || Boolean(savedSlug)} onClick={save}><Save size={17}/>{saving ? "در حال ذخیره" : "ذخیره مسابقه"}</Button>}</div>
    </Card>
  </div>;
}
