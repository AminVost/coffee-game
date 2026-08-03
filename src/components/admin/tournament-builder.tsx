"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Save, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { FieldHint, Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TOURNAMENT_FORMATS, openRegistrationStatusError } from "@/lib/tournament-definition";

const steps = ["اطلاعات پایه", "ساختار مسابقه", "پرداخت و ظرفیت", "زمان و قوانین", "انتشار"];

type Option = { id: number; title: string };
type TemplateItem = {
  id: number | string;
  game_id: number;
  title: string;
  configuration: Record<string, unknown> | string;
};

type FormState = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  gameId: number;
  templateId: number | null;
  venueId: number | null;
  format: (typeof TOURNAMENT_FORMATS)[number];
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
  capacity: number;
  minParticipants: number;
  price: number;
  reservationExpiresMin: number;
  registrationStartsAt: string;
  registrationEndsAt: string;
  startsAt: string;
  endsAt: string;
  lateToleranceMin: number;
  waitlistMode: "disabled" | "offer" | "manual" | "automatic";
  allowMultiSlot: boolean;
  hasThirdPlace: boolean;
  drawMode: "random" | "seeded" | "custom";
  rulesText: string;
  coverImageUrl: string;
  isFeatured: boolean;
  status: "DRAFT" | "PUBLISHED" | "REGISTRATION_OPEN";
};

function localValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function createInitialForm(): FormState {
  const now = new Date();
  now.setSeconds(0, 0);
  const tournamentStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const registrationEnd = new Date(tournamentStart.getTime() - 2 * 60 * 60 * 1000);
  const tournamentEnd = new Date(tournamentStart.getTime() + 4 * 60 * 60 * 1000);

  return {
    title: "",
    slug: `tournament-${Date.now()}`,
    subtitle: "",
    description: "",
    gameId: 1,
    templateId: null,
    venueId: 1,
    format: "حذفی تک‌بازی",
    participantType: "INDIVIDUAL",
    teamSize: 1,
    capacity: 32,
    minParticipants: 2,
    price: 350000,
    reservationExpiresMin: 30,
    registrationStartsAt: localValue(now),
    registrationEndsAt: localValue(registrationEnd),
    startsAt: localValue(tournamentStart),
    endsAt: localValue(tournamentEnd),
    lateToleranceMin: 10,
    waitlistMode: "offer",
    allowMultiSlot: false,
    hasThirdPlace: false,
    drawMode: "random",
    rulesText: "",
    coverImageUrl: "",
    isFeatured: false,
    status: "DRAFT"
  };
}

function readTemplateConfiguration(value: TemplateItem["configuration"]) {
  if (typeof value !== "string") return value || {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function iso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function TournamentBuilder({ initialTemplateId }: { initialTemplateId?: number }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [games, setGames] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tournament-options", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/templates", { cache: "no-store" }).then((response) => response.json())
    ]).then(([options, templatePayload]) => {
      const loadedGames: Option[] = options.games || [];
      const loadedVenues: Option[] = options.venues || [];
      const loadedTemplates: TemplateItem[] = templatePayload.items || [];
      setGames(loadedGames);
      setVenues(loadedVenues);
      setTemplates(loadedTemplates);

      setForm((current) => {
        const base: FormState = {
          ...current,
          gameId: loadedGames.some((game) => game.id === current.gameId)
            ? current.gameId
            : Number(loadedGames[0]?.id || current.gameId),
          venueId: loadedVenues.some((venue) => venue.id === current.venueId)
            ? current.venueId
            : loadedVenues[0]?.id || null
        };
        const selected = initialTemplateId
          ? loadedTemplates.find((item) => Number(item.id) === initialTemplateId)
          : null;
        return selected ? applyTemplate(base, selected) : base;
      });
    }).catch(() => setError("دریافت تنظیمات اولیه انجام نشد."));
  }, [initialTemplateId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyTemplate(current: FormState, selected: TemplateItem): FormState {
    const config = readTemplateConfiguration(selected.configuration);
    const format = TOURNAMENT_FORMATS.includes(config.format as FormState["format"])
      ? config.format as FormState["format"]
      : current.format;
    const participantType = config.participantType === "TEAM" ? "TEAM" : "INDIVIDUAL";
    const teamSize = participantType === "TEAM" ? Number(config.teamSize || 2) : 1;

    return {
      ...current,
      templateId: Number(selected.id),
      gameId: Number(selected.game_id),
      format,
      capacity: Number(config.capacity || current.capacity),
      minParticipants: Number(config.minParticipants || current.minParticipants),
      price: Number(config.price ?? current.price),
      reservationExpiresMin: Number(config.reservationExpiresMin ?? current.reservationExpiresMin),
      teamSize,
      participantType,
      lateToleranceMin: Number(config.lateToleranceMin ?? current.lateToleranceMin),
      waitlistMode: ["disabled", "offer", "manual", "automatic"].includes(String(config.waitlistMode))
        ? String(config.waitlistMode) as FormState["waitlistMode"]
        : current.waitlistMode,
      allowMultiSlot: typeof config.allowMultiSlot === "boolean" ? config.allowMultiSlot : current.allowMultiSlot,
      hasThirdPlace: typeof config.hasThirdPlace === "boolean" ? config.hasThirdPlace : current.hasThirdPlace,
      drawMode: ["random", "seeded", "custom"].includes(String(config.drawMode))
        ? String(config.drawMode) as FormState["drawMode"]
        : current.drawMode,
      rulesText: Array.isArray(config.rules)
        ? config.rules.filter((item): item is string => typeof item === "string").join("\n")
        : current.rulesText
    };
  }

  function selectTemplate(value: string) {
    if (!value) {
      update("templateId", null);
      return;
    }
    const selected = templates.find((item) => String(item.id) === value);
    if (selected) setForm((current) => applyTemplate(current, selected));
  }

  const scheduleIsValid = useMemo(() => {
    if (!form.startsAt) return false;
    const start = new Date(form.startsAt).getTime();
    const end = form.endsAt ? new Date(form.endsAt).getTime() : null;
    const registrationStart = form.registrationStartsAt
      ? new Date(form.registrationStartsAt).getTime()
      : null;
    const registrationEnd = form.registrationEndsAt
      ? new Date(form.registrationEndsAt).getTime()
      : null;
    if (start <= Date.now()) return false;
    if ((registrationStart === null) !== (registrationEnd === null)) return false;
    if (registrationStart !== null && registrationEnd !== null) {
      if (registrationStart >= registrationEnd || registrationEnd >= start) return false;
    }
    if (end !== null && end <= start) return false;
    return true;
  }, [form.endsAt, form.registrationEndsAt, form.registrationStartsAt, form.startsAt]);

  const canNext = useMemo(() => {
    if (step === 0) {
      return form.title.trim().length >= 3
        && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
        && form.gameId > 0;
    }
    if (step === 1) {
      return form.capacity >= 2
        && form.minParticipants >= 2
        && form.minParticipants <= form.capacity
        && (form.participantType === "INDIVIDUAL" || form.teamSize >= 2);
    }
    if (step === 2) return form.price >= 0 && form.reservationExpiresMin >= 5;
    if (step === 3) return scheduleIsValid;
    return true;
  }, [form, scheduleIsValid, step]);

  async function save() {
    setSaving(true);
    setError("");
    setSavedSlug("");

    try {
      if (!scheduleIsValid) {
        throw new Error("ترتیب تاریخ‌های ثبت‌نام و مسابقه را بررسی کنید.");
      }
      if (form.status === "REGISTRATION_OPEN") {
        const statusError = openRegistrationStatusError({
          registrationStartsAt: iso(form.registrationStartsAt),
          registrationEndsAt: iso(form.registrationEndsAt),
          startsAt: new Date(form.startsAt).toISOString()
        });
        if (statusError) throw new Error(statusError);
      }

      const rules = form.rulesText.split("\n").map((rule) => rule.trim()).filter(Boolean);
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
        rules,
        gameSettings: {},
        scoringSettings: {},
        notificationSettings: {},
        cancellationSettings: {},
        prizeSettings: {},
        coverImageUrl: form.coverImageUrl || null,
        isFeatured: form.isFeatured,
        status: form.status
      };

      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
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
              minParticipants: form.minParticipants,
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
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-black ${index <= step ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
            {index < step ? <Check size={17} /> : index + 1}
          </span>
          <span className={`mr-2 text-xs font-bold ${index <= step ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{label}</span>
          {index < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-[var(--line)]" />}
        </div>)}
      </div>
    </div>

    <Card className="p-6 sm:p-8">
      {step === 0 && <div className="grid gap-5 sm:grid-cols-2">
        <Label className="sm:col-span-2">
          استفاده از قالب ذخیره‌شده
          <SelectField
            value={form.templateId ? String(form.templateId) : "none"}
            onValueChange={(value) => selectTemplate(value === "none" ? "" : value)}
            options={[{ value: "none", label: "بدون قالب" }, ...templates.map((item) => ({ value: String(item.id), label: item.title }))]}
          />
          <FieldHint>قالب فقط تنظیمات اولیه را کپی می‌کند و بعداً قابل ویرایش است.</FieldHint>
        </Label>
        <Label>عنوان مسابقه<Input value={form.title} onChange={(event) => update("title", event.target.value)} /></Label>
        <Label>
          Slug انگلیسی
          <Input dir="ltr" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} />
        </Label>
        <Label>زیرعنوان<Input value={form.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></Label>
        <Label>بازی<SelectField value={String(form.gameId)} onValueChange={(value) => update("gameId", Number(value))} options={games.map((game) => ({ value: String(game.id), label: game.title }))} /></Label>
        <Label>محل<SelectField value={form.venueId ? String(form.venueId) : "none"} onValueChange={(value) => update("venueId", value === "none" ? null : Number(value))} options={[{ value: "none", label: "اعلام بعدی" }, ...venues.map((venue) => ({ value: String(venue.id), label: venue.title }))]} /></Label>
        <Label className="sm:col-span-2">توضیحات<Textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></Label>
      </div>}

      {step === 1 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>فرمت<SelectField value={form.format} onValueChange={(value) => update("format", value as FormState["format"])} options={TOURNAMENT_FORMATS.map((value) => ({ value, label: value }))} /></Label>
        <Label>نوع شرکت<SelectField value={form.participantType} onValueChange={(value) => setForm((current) => ({ ...current, participantType: value as FormState["participantType"], teamSize: value === "INDIVIDUAL" ? 1 : Math.max(2, current.teamSize) }))} options={[{ value: "INDIVIDUAL", label: "انفرادی" }, { value: "TEAM", label: "تیمی" }]} /></Label>
        {form.participantType === "TEAM" && <Label>تعداد اعضای تیم<Input type="number" min="2" max="20" value={form.teamSize} onChange={(event) => update("teamSize", Number(event.target.value))} /></Label>}
        <Label>
          ظرفیت کل
          <Input type="number" min="2" value={form.capacity} onChange={(event) => update("capacity", Number(event.target.value))} />
          <FieldHint>{form.participantType === "TEAM" ? "تعداد تیم‌ها" : "تعداد بازیکنان"}</FieldHint>
        </Label>
        <Label>حداقل نفر برای برگزاری<Input type="number" min="2" max={form.capacity} value={form.minParticipants} onChange={(event) => update("minParticipants", Number(event.target.value))} /></Label>
        <Label>نوع قرعه<SelectField value={form.drawMode} onValueChange={(value) => update("drawMode", value as FormState["drawMode"])} options={[{ value: "random", label: "تصادفی" }, { value: "seeded", label: "Seed بندی" }, { value: "custom", label: "دستی" }]} /></Label>
        <Label>مسابقه رده‌بندی<SelectField value={form.hasThirdPlace ? "yes" : "no"} onValueChange={(value) => update("hasThirdPlace", value === "yes")} options={[{ value: "yes", label: "فعال" }, { value: "no", label: "غیرفعال" }]} /></Label>
        <Label>خرید چند سهم<SelectField value={form.allowMultiSlot ? "yes" : "no"} onValueChange={(value) => update("allowMultiSlot", value === "yes")} options={[{ value: "yes", label: "فعال" }, { value: "no", label: "غیرفعال" }]} /></Label>
      </div>}

      {step === 2 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>هزینه هر سهم (تومان)<Input type="number" min="0" value={form.price} onChange={(event) => update("price", Number(event.target.value))} /></Label>
        <Label>مهلت رزرو بدون پرداخت (دقیقه)<Input type="number" min="5" value={form.reservationExpiresMin} onChange={(event) => update("reservationExpiresMin", Number(event.target.value))} /></Label>
        <Label>صف انتظار<SelectField value={form.waitlistMode} onValueChange={(value) => update("waitlistMode", value as FormState["waitlistMode"])} options={[{ value: "disabled", label: "غیرفعال" }, { value: "offer", label: "پیشنهاد با مهلت پاسخ" }, { value: "manual", label: "مدیریت دستی" }, { value: "automatic", label: "خودکار" }]} /></Label>
        <Alert tone="info" className="sm:col-span-2">روش پرداخت از تنظیمات عمومی سایت خوانده می‌شود. این بخش فقط مبلغ، زمان رزرو و رفتار صف انتظار همین مسابقه را مشخص می‌کند.</Alert>
      </div>}

      {step === 3 && <div className="grid gap-5 sm:grid-cols-2">
        <Label>شروع ثبت‌نام<PersianDatePicker mode="datetime" value={form.registrationStartsAt} onChange={(value) => update("registrationStartsAt", value)} /></Label>
        <Label>پایان ثبت‌نام<PersianDatePicker mode="datetime" value={form.registrationEndsAt} onChange={(value) => update("registrationEndsAt", value)} /></Label>
        <Label>شروع مسابقه<PersianDatePicker mode="datetime" value={form.startsAt} onChange={(value) => update("startsAt", value)} required /></Label>
        <Label>پایان تقریبی مسابقه<PersianDatePicker mode="datetime" value={form.endsAt} onChange={(value) => update("endsAt", value)} /></Label>
        <Label>مهلت تأخیر (دقیقه)<Input type="number" min="0" max="180" value={form.lateToleranceMin} onChange={(event) => update("lateToleranceMin", Number(event.target.value))} /></Label>
        <Label className="sm:col-span-2">قوانین؛ هر قانون در یک خط<Textarea className="min-h-40" value={form.rulesText} onChange={(event) => update("rulesText", event.target.value)} /></Label>
        {!scheduleIsValid && <Alert tone="warning" className="sm:col-span-2">ترتیب درست: شروع ثبت‌نام، پایان ثبت‌نام، شروع مسابقه و سپس پایان مسابقه.</Alert>}
      </div>}

      {step === 4 && <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/12 text-emerald-500"><Sparkles size={30} /></span>
        <h2 className="mt-5 text-2xl font-black">مسابقه آماده ذخیره است</h2>
        <Label className="mx-auto mt-6 max-w-md text-right">
          وضعیت اولیه
          <SelectField value={form.status} onValueChange={(value) => update("status", value as FormState["status"])} options={[{ value: "DRAFT", label: "پیش‌نویس؛ فقط مدیر می‌بیند" }, { value: "PUBLISHED", label: "منتشرشده؛ ثبت‌نام بسته" }, { value: "REGISTRATION_OPEN", label: "ثبت‌نام باز؛ فقط در بازه تعیین‌شده" }]} />
        </Label>
        <div className="mx-auto mt-4 flex max-w-md items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm font-bold">
          <span>ذخیره تنظیمات به‌عنوان قالب</span>
          <Switch checked={saveAsTemplate} onCheckedChange={setSaveAsTemplate} aria-label="ذخیره به عنوان قالب" />
        </div>
        <FieldHint className="mx-auto mt-2 block max-w-md">این گزینه به‌صورت پیش‌فرض خاموش است تا برای هر مسابقه قالب تکراری ساخته نشود.</FieldHint>
        {savedSlug && <Alert tone="success" className="mx-auto mt-5 max-w-xl justify-center">مسابقه ذخیره شد. <a className="underline" href={`/tournaments/${savedSlug}`}>مشاهده صفحه مسابقه</a></Alert>}
      </div>}

      {error && <Alert tone="error" className="mt-6">{error}</Alert>}

      <div className="mt-8 flex justify-between border-t border-[var(--line)] pt-6">
        <Button type="button" variant="secondary" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}><ChevronRight size={17} />قبلی</Button>
        {step < steps.length - 1
          ? <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>مرحله بعد<ChevronLeft size={17} /></Button>
          : <Button type="button" disabled={Boolean(savedSlug)} onClick={save} loading={saving} loadingText="در حال ذخیره"><Save size={17} />ذخیره مسابقه</Button>}
      </div>
    </Card>
  </div>;
}
