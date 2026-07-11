"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chrome, Eye, EyeOff, KeyRound, LockKeyhole, Mail, MessageSquareText, Phone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldHint } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("admin@coffeegame.local");
  const [password, setPassword] = useState("Admin@123");
  const [mobile, setMobile] = useState("09120000000");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [debugCode, setDebugCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"password" | "sms">("password");

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ورود انجام نشد.");
      router.push(data.role === "admin" ? "/admin" : "/account");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ورود انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function requestCode() {
    setSendingCode(true);
    setError("");
    setMessage("");
    setDebugCode("");
    try {
      const response = await fetch("/api/auth/sms/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ارسال کد انجام نشد.");
      setCodeSent(true);
      setMessage(data.message || "کد تایید ارسال شد.");
      setDebugCode(data.debugCode || "");
      if (data.debugCode) setCode(String(data.debugCode));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ارسال کد انجام نشد.");
    } finally {
      setSendingCode(false);
    }
  }

  async function submitSms(event: React.FormEvent) {
    event.preventDefault();
    if (!codeSent) {
      await requestCode();
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "کد تایید نادرست است.");
      router.push("/account");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تایید کد انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  function changeTab(value: string) {
    const next = value === "sms" ? "sms" : "password";
    setTab(next);
    setError("");
    setMessage("");
  }

  return (
    <div>
      <Tabs value={tab} onValueChange={changeTab} dir="rtl">
        <TabsList className="grid-cols-2">
          <TabsTrigger value="password"><KeyRound size={16} />رمز عبور</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquareText size={16} />کد پیامکی</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "password" ? (
        <form onSubmit={submitPassword} className="mt-6 grid gap-5">
          <Label>
            ایمیل یا شماره موبایل
            <div className="relative">
              <Mail className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
              <Input className="pr-11" value={identifier} onChange={(event) => setIdentifier(event.target.value)} dir="ltr" autoComplete="username" required />
            </div>
          </Label>
          <Label>
            رمز عبور
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
              <Input className="px-11" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" autoComplete="current-password" required />
              <Button type="button" variant="ghost" size="iconSm" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </Button>
            </div>
          </Label>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={loading} loadingText="در حال ورود...">ورود به حساب</Button>
        </form>
      ) : (
        <form onSubmit={submitSms} className="mt-6 grid gap-5">
          <Label>
            شماره موبایل
            <div className="relative">
              <Phone className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
              <Input className="pr-11" value={mobile} onChange={(event) => { setMobile(event.target.value); setCodeSent(false); }} dir="ltr" inputMode="tel" pattern="09[0-9]{9}" placeholder="09123456789" required />
            </div>
          </Label>
          {codeSent && (
            <Label>
              کد تایید شش‌رقمی
              <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} dir="ltr" inputMode="numeric" pattern="[0-9]{6}" placeholder="------" className="text-center text-lg tracking-[.45em]" required />
              <FieldHint>کد فقط یک بار قابل استفاده است و زمان محدودی اعتبار دارد.</FieldHint>
            </Label>
          )}
          {message && <Alert tone="success">{message}{debugCode && <span className="mt-1 block" dir="ltr">Development code: {debugCode}</span>}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={loading || sendingCode} loadingText={codeSent ? "در حال تایید..." : "در حال ارسال..."}>
            {codeSent ? "تایید و ورود" : "ارسال کد تایید"}
          </Button>
          {codeSent && <Button type="button" variant="ghost" className="w-full" onClick={requestCode} disabled={sendingCode}>ارسال مجدد کد</Button>}
        </form>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]" />یا<span className="h-px flex-1 bg-[var(--line)]" /></div>
      <Button variant="secondary" className="w-full" type="button" disabled><Chrome size={18} />ورود با Google — پس از ثبت کلیدها</Button>
      <Alert tone="warning" className="mt-5 text-xs font-normal">در محیط Local می‌توانی با حساب مدیر نمونه وارد شوی. ورود پیامکی در حالت MySQL از OTP واقعی دیتابیس استفاده می‌کند.</Alert>
    </div>
  );
}
