"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  KeyRound,
  Link2,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldHint } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";

type PlayerInput = { name: string; mobile: string };
type PaymentMethod = "card_to_card" | "pos" | "cash";
type Step = "details" | "otp" | "payment" | "success" | "expired";

type HoldState = {
  token: string;
  expiresAt: string;
  amount: number;
  contactMobile: string;
};

type ResultState = {
  status: string;
  trackingCode: string;
  trackingPath: string;
  trackingUrl: string;
  paymentMethod: PaymentMethod;
  reservedUntil?: string | null;
  receiptWarning?: string;
};

const paymentOptions = [
  { value: "card_to_card", label: "کارت‌به‌کارت / انتقال بانکی" },
  { value: "pos", label: "کارتخوان حضوری" },
  { value: "cash", label: "پرداخت نقدی حضوری" }
];

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toLocaleString("fa-IR")}:${String(seconds).padStart(2, "0")}`;
}

export function RegisterTournamentForm({
  tournament,
  initialUser
}: {
  tournament: Tournament;
  initialUser?: { name?: string; mobile?: string } | null;
}) {
  const teamSize = useMemo(() => {
    const match = tournament.participantMode.match(/تیمی\s+(\d+)/);
    return match ? Number(match[1]) : 0;
  }, [tournament.participantMode]);
  const isTeam = teamSize > 0;

  const [players, setPlayers] = useState<PlayerInput[]>(
    Array.from({ length: isTeam ? teamSize : 1 }, (_, index) => ({
      name: index === 0 ? initialUser?.name || "" : "",
      mobile: index === 0 ? initialUser?.mobile || "" : ""
    }))
  );
  const [teamTitle, setTeamTitle] = useState("");
  const [step, setStep] = useState<Step>("details");
  const [contactMobile, setContactMobile] = useState(initialUser?.mobile || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [hold, setHold] = useState<HoldState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [payment, setPayment] = useState<PaymentMethod>("card_to_card");
  const [payerName, setPayerName] = useState(initialUser?.name || "");
  const [cardLast4, setCardLast4] = useState("");
  const [bankTrackingCode, setBankTrackingCode] = useState("");
  const [paidOn, setPaidOn] = useState(localDateValue);
  const [paidTime, setPaidTime] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const [result, setResult] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyDone, setCopyDone] = useState("");
  const [error, setError] = useState("");

  const totalAmount = tournament.price * (isTeam ? 1 : players.length);
  const holdStorageKey = `cgs-registration-hold-${tournament.id}`;

  useEffect(() => {
    if (!initialUser?.mobile) return;

    const stored = window.sessionStorage.getItem(holdStorageKey);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as HoldState;
      if (!parsed.token || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        window.sessionStorage.removeItem(holdStorageKey);
        return;
      }

      void (async () => {
        const response = await fetch(`/api/registration-holds/${parsed.token}`, {
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "ACTIVE") {
          window.sessionStorage.removeItem(holdStorageKey);
          return;
        }

        setPlayers(payload.players || players);
        setTeamTitle(payload.teamTitle || "");
        setContactMobile(payload.contactMobile || initialUser.mobile || "");
        setHold({
          token: payload.holdToken,
          expiresAt: payload.expiresAt,
          amount: Number(payload.amount),
          contactMobile: payload.contactMobile
        });
        setStep("payment");
      })();
    } catch {
      window.sessionStorage.removeItem(holdStorageKey);
    }
    // Only restore once when this tournament form mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdStorageKey, initialUser?.mobile]);

  useEffect(() => {
    if (!hold || step !== "payment") return;

    function tick() {
      const seconds = Math.max(
        0,
        Math.ceil((new Date(hold!.expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(seconds);
      if (seconds <= 0) {
        window.sessionStorage.removeItem(holdStorageKey);
        setStep("expired");
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [hold, holdStorageKey, step]);

  function updatePlayer(index: number, key: keyof PlayerInput, value: string) {
    setPlayers((items) => items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  function validateInitialDetails() {
    if (isTeam && teamTitle.trim().length < 2) {
      return "نام تیم را وارد کنید.";
    }

    for (const player of players) {
      if (player.name.trim().length < 2) return "نام همه شرکت‌کنندگان را وارد کنید.";
      if (!/^09\d{9}$/.test(player.mobile.trim())) {
        return "شماره موبایل همه شرکت‌کنندگان را صحیح وارد کنید.";
      }
    }

    const normalizedMobiles = players.map((player) => player.mobile.trim());
    if (new Set(normalizedMobiles).size !== normalizedMobiles.length) {
      return "هر شماره موبایل را فقط یک‌بار وارد کنید.";
    }

    return "";
  }

  async function createHold() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/registration-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          players,
          teamTitle: isTeam ? teamTitle : undefined
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setStep("otp");
          throw new Error(payload.message || "شماره موبایل خود را تایید کنید.");
        }
        throw new Error(payload.message || "رزرو موقت ظرفیت انجام نشد.");
      }

      const nextHold: HoldState = {
        token: payload.holdToken,
        expiresAt: payload.expiresAt,
        amount: Number(payload.amount),
        contactMobile: payload.contactMobile
      };
      setHold(nextHold);
      setContactMobile(payload.contactMobile);
      window.sessionStorage.setItem(holdStorageKey, JSON.stringify(nextHold));
      setStep("payment");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "رزرو موقت ظرفیت انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function submitInitialDetails(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const validationError = validateInitialDetails();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (initialUser?.mobile) {
      await createHold();
      return;
    }

    setContactMobile(players[0]?.mobile || "");
    setStep("otp");
  }

  async function requestOtp() {
    if (!/^09\d{9}$/.test(contactMobile)) {
      setError("شماره موبایل را صحیح وارد کنید.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sms/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: contactMobile })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "ارسال کد انجام نشد.");
      setOtpRequested(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ارسال کد انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtpAndReserve(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otpCode)) {
      setError("کد ۶ رقمی را وارد کنید.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: contactMobile,
          code: otpCode,
          name: players[0]?.name
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "تأیید کد انجام نشد.");

      await createHold();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تأیید کد انجام نشد.");
      setLoading(false);
    }
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!hold) {
      setStep("expired");
      return;
    }

    if (remainingSeconds <= 0) {
      setStep("expired");
      return;
    }

    if (payment === "card_to_card") {
      if (payerName.trim().length < 2) {
        setError("نام واریزکننده را وارد کنید.");
        return;
      }
      if (!/^\d{4}$/.test(cardLast4)) {
        setError("۴ رقم آخر کارت واریزکننده را صحیح وارد کنید.");
        return;
      }
      if (bankTrackingCode.trim().length < 4) {
        setError("کد پیگیری انتقال را وارد کنید.");
        return;
      }
      if (!paidOn) {
        setError("تاریخ واریز را وارد کنید.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdToken: hold.token,
          payment,
          paymentDetails: payment === "card_to_card" ? {
            payerName,
            cardLast4,
            trackingCode: bankTrackingCode,
            paidOn,
            paidTime: paidTime || undefined
          } : undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.expired) setStep("expired");
        throw new Error(payload.message || "ثبت‌نام انجام نشد.");
      }

      let receiptWarning = "";
      if (payment === "card_to_card" && receipt && payload.paymentId) {
        const form = new FormData();
        form.set("paymentId", payload.paymentId);
        form.set("file", receipt);
        if (payload.receiptToken) form.set("receiptToken", payload.receiptToken);

        const uploadResponse = await fetch("/api/payments/receipts", {
          method: "POST",
          body: form
        });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok) {
          receiptWarning = uploadPayload.message
            || "اطلاعات واریز ثبت شد، اما تصویر اختیاری رسید بارگذاری نشد.";
        }
      }

      window.sessionStorage.removeItem(holdStorageKey);
      setResult({
        status: payload.status,
        trackingCode: payload.trackingCode,
        trackingPath: payload.trackingPath,
        trackingUrl: payload.trackingUrl,
        paymentMethod: payment,
        reservedUntil: payload.reservedUntil || null,
        receiptWarning
      });
      setStep("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ثبت‌نام انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    if (hold?.token) {
      await fetch(`/api/registration-holds/${hold.token}`, {
        method: "DELETE"
      }).catch(() => undefined);
    }
    window.sessionStorage.removeItem(holdStorageKey);
    setHold(null);
    setOtpCode("");
    setOtpRequested(false);
    setError("");
    setStep("details");
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyDone(key);
      window.setTimeout(() => setCopyDone(""), 1400);
    } catch {
      setError("کپی خودکار انجام نشد.");
    }
  }

  if (step === "success" && result) {
    const title = result.paymentMethod === "card_to_card"
      ? "اطلاعات پرداخت برای بررسی ارسال شد"
      : "رزرو پرداخت حضوری ثبت شد";
    const description = result.paymentMethod === "card_to_card"
      ? "پس از تطبیق اطلاعات انتقال توسط مدیر، وضعیت ثبت‌نام در لینک پیگیری به‌روزرسانی می‌شود."
      : result.reservedUntil
        ? `پرداخت حضوری را تا ${new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date(result.reservedUntil))} انجام دهید.`
        : "پس از پرداخت حضوری و تأیید صندوق، ثبت‌نام نهایی می‌شود.";

    return (
      <div className="rounded-[1.75rem] border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
        <h3 className="mt-4 text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>

        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-[var(--surface)] p-4 text-right">
          <p className="text-xs text-[var(--muted)]">کد پیگیری ثبت‌نام</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <strong dir="ltr">{result.trackingCode}</strong>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copy(result.trackingCode, "code")}
            >
              <Clipboard size={15} />
              {copyDone === "code" ? "کپی شد" : "کپی کد"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button href={result.trackingPath}>
            <Link2 size={16} />
            مشاهده وضعیت ثبت‌نام
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => copy(result.trackingUrl, "link")}
          >
            <Clipboard size={15} />
            {copyDone === "link" ? "لینک کپی شد" : "کپی لینک پیگیری"}
          </Button>
        </div>

        <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
          لینک پیگیری را نگه دارید؛ بدون ورود می‌توانید آخرین وضعیت را مشاهده کنید.
        </p>

        {result.receiptWarning && (
          <Alert tone="warning" className="mt-4 text-right">
            {result.receiptWarning}
          </Alert>
        )}
      </div>
    );
  }

  if (step === "expired") {
    return (
      <div className="rounded-[1.75rem] border border-amber-500/25 bg-amber-500/10 p-6 text-center">
        <Clock3 className="mx-auto text-amber-600" size={44} />
        <h3 className="mt-4 text-lg font-black">مهلت رزرو ظرفیت پایان یافت</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          ظرفیت موقت آزاد شده است. برای ادامه، دوباره اطلاعات اولیه را ثبت و ظرفیت را بررسی کنید.
        </p>
        {error && <Alert tone="error" className="mt-4 text-right">{error}</Alert>}
        <Button type="button" className="mt-5" onClick={restart}>
          <RotateCcw size={16} />
          شروع دوباره
        </Button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={verifyOtpAndReserve} className="grid gap-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={19} className="text-[var(--brand)]" />
            <h3 className="font-black">تأیید شماره موبایل ثبت‌کننده</h3>
          </div>
          <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
            اطلاعات اولیه حفظ شده است. پس از تأیید شماره، وارد حساب می‌شوید و ظرفیت ۱۵ دقیقه رزرو خواهد شد.
          </p>
        </div>

        <Label>
          شماره موبایل
          <Input
            dir="ltr"
            inputMode="tel"
            value={contactMobile}
            onChange={(event) => {
              setContactMobile(event.target.value.replace(/\D/g, "").slice(0, 11));
              setOtpRequested(false);
              setOtpCode("");
            }}
            pattern="09[0-9]{9}"
            placeholder="09xxxxxxxxx"
            required
          />
          <FieldHint>این شماره مالک ثبت‌نام و اطلاعات پرداخت خواهد بود.</FieldHint>
        </Label>

        {!otpRequested ? (
          <Button
            type="button"
            loading={loading}
            loadingText="در حال ارسال..."
            onClick={requestOtp}
          >
            <KeyRound size={17} />
            ارسال کد تأیید
          </Button>
        ) : (
          <>
            <Label>
              کد تأیید ۶ رقمی
              <Input
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="------"
                required
              />
            </Label>
            <Button type="submit" loading={loading} loadingText="در حال تأیید...">
              تأیید شماره و رزرو ظرفیت
            </Button>
            <Button type="button" variant="ghost" disabled={loading} onClick={requestOtp}>
              ارسال مجدد کد
            </Button>
          </>
        )}

        <Button type="button" variant="secondary" disabled={loading} onClick={() => setStep("details")}>
          بازگشت به اطلاعات شرکت‌کنندگان
        </Button>
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    );
  }

  if (step === "payment" && hold) {
    return (
      <form onSubmit={submitPayment} className="grid gap-5">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <strong className="inline-flex items-center gap-2 text-sm">
                <Clock3 size={17} />
                ظرفیت موقتاً برای شما رزرو شد
              </strong>
              <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                اطلاعات پرداخت را پیش از پایان زمان ارسال کنید.
              </p>
            </div>
            <strong className="text-lg text-amber-600" dir="ltr">
              {formatRemaining(remainingSeconds)}
            </strong>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-[var(--muted)]">مبلغ قابل پرداخت</span>
            <strong className="text-lg text-[var(--brand)]">{formatToman(hold.amount)}</strong>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            شماره تأییدشده: <span dir="ltr">{hold.contactMobile}</span>
          </p>
        </div>

        <Label>
          روش پرداخت
          <SelectField
            value={payment}
            onValueChange={(value) => setPayment(value as PaymentMethod)}
            options={paymentOptions}
          />
        </Label>

        {payment === "card_to_card" && (
          <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)]">
                <CreditCard size={19} />
              </span>
              <div>
                <strong className="text-sm">اطلاعات انتقال بانکی</strong>
                <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                  مدیر با کد پیگیری، مبلغ، تاریخ و ۴ رقم آخر کارت واریز را تطبیق می‌دهد.
                </p>
              </div>
            </div>

            <Label>
              نام و نام خانوادگی واریزکننده
              <Input
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                maxLength={120}
                placeholder="نام صاحب کارت یا حساب"
                required
              />
            </Label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Label>
                ۴ رقم آخر کارت
                <Input
                  value={cardLast4}
                  onChange={(event) => setCardLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  dir="ltr"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="مثلاً 5531"
                  required
                />
              </Label>
              <Label>
                کد پیگیری
                <Input
                  value={bankTrackingCode}
                  onChange={(event) => setBankTrackingCode(event.target.value.replace(/\s/g, "").slice(0, 64))}
                  dir="ltr"
                  placeholder="کد پیگیری انتقال"
                  required
                />
              </Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Label>
                تاریخ واریز
                <Input
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  required
                />
              </Label>
              <Label>
                ساعت واریز <span className="font-normal text-[var(--muted)]">(اختیاری)</span>
                <Input
                  type="time"
                  value={paidTime}
                  onChange={(event) => setPaidTime(event.target.value)}
                />
              </Label>
            </div>

            <Label>
              تصویر رسید <span className="font-normal text-[var(--muted)]">(اختیاری)</span>
              <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-3">
                  <Upload size={18} className="text-[var(--brand)]" />
                  <Input
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(event) => setReceipt(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <FieldHint>ارسال تصویر اجباری نیست. JPG، PNG یا PDF حداکثر ۵ مگابایت</FieldHint>
            </Label>
          </div>
        )}

        {payment === "pos" && (
          <Alert tone="info">
            <span className="inline-flex items-center gap-2 font-bold">
              <ReceiptText size={17} />
              پرداخت با کارتخوان حضوری
            </span>
            <span className="mt-1 block text-xs leading-6">
              بعد از ثبت رزرو، برای پرداخت در مهلت اعلام‌شده به صندوق مراجعه کنید.
            </span>
          </Alert>
        )}

        {payment === "cash" && (
          <Alert tone="info">
            <span className="inline-flex items-center gap-2 font-bold">
              <Banknote size={17} />
              پرداخت نقدی حضوری
            </span>
            <span className="mt-1 block text-xs leading-6">
              بعد از ثبت رزرو، برای تحویل وجه در مهلت اعلام‌شده به صندوق مراجعه کنید.
            </span>
          </Alert>
        )}

        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={loading} loadingText="در حال ثبت...">
          {payment === "card_to_card"
            ? "ارسال اطلاعات پرداخت و ثبت‌نام"
            : "ثبت رزرو پرداخت حضوری"}
        </Button>
        <Button type="button" variant="ghost" disabled={loading} onClick={restart}>
          لغو رزرو موقت
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitInitialDetails} className="grid gap-5">
      <div>
        <h3 className="font-black">{isTeam ? "اعضای تیم" : "شرکت‌کنندگان"}</h3>
        <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
          {isTeam
            ? `برای این مسابقه باید ${teamSize.toLocaleString("fa-IR")} عضو وارد شود.`
            : "اطلاعات اولیه را وارد کنید؛ سپس شماره موبایل ثبت‌کننده تأیید می‌شود."}
        </p>
      </div>

      {isTeam && (
        <Label>
          نام تیم
          <Input
            value={teamTitle}
            onChange={(event) => setTeamTitle(event.target.value)}
            placeholder="مثلاً تیم توربو"
            required
          />
        </Label>
      )}

      {players.map((player, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input
            placeholder="نام و نام خانوادگی"
            value={player.name}
            onChange={(event) => updatePlayer(index, "name", event.target.value)}
            required
          />
          <Input
            placeholder="شماره موبایل"
            dir="ltr"
            inputMode="tel"
            value={player.mobile}
            onChange={(event) => updatePlayer(
              index,
              "mobile",
              event.target.value.replace(/\D/g, "").slice(0, 11)
            )}
            pattern="09[0-9]{9}"
            required
          />
          <Button
            type="button"
            variant="dangerSoft"
            size="icon"
            disabled={isTeam || players.length === 1}
            onClick={() => setPlayers(players.filter((_, itemIndex) => itemIndex !== index))}
            aria-label="حذف شرکت‌کننده"
          >
            <Trash2 size={17} />
          </Button>
        </div>
      ))}

      {!isTeam && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPlayers([...players, { name: "", mobile: "" }])}
        >
          <Plus size={17} />
          افزودن شرکت‌کننده دیگر
        </Button>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-[var(--muted)]">مبلغ ثبت‌نام</span>
          <strong className="text-lg text-[var(--brand)]">{formatToman(totalAmount)}</strong>
        </div>
      </div>

      {initialUser?.mobile && (
        <Alert tone="success">
          با شماره <span dir="ltr">{initialUser.mobile}</span> وارد شده‌اید. پس از ادامه، ظرفیت برای ۱۵ دقیقه رزرو می‌شود.
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" loading={loading} loadingText="در حال بررسی...">
        ادامه و رزرو ۱۵ دقیقه‌ای ظرفیت
      </Button>
    </form>
  );
}
