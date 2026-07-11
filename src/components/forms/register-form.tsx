"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldHint } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "ثبت‌نام انجام نشد.");
      setSuccess("حساب با موفقیت ساخته شد. اکنون وارد حساب خودت شو.");
      window.setTimeout(() => router.push("/login"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ثبت‌نام انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Label>
        نام و نام خانوادگی
        <div className="relative">
          <UserRound className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <Input className="pr-11" value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" minLength={2} required />
        </div>
      </Label>
      <Label>
        شماره موبایل
        <div className="relative">
          <Phone className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <Input className="pr-11" value={form.mobile} onChange={(event) => update("mobile", event.target.value.replace(/\D/g, "").slice(0, 11))} dir="ltr" inputMode="tel" pattern="09[0-9]{9}" placeholder="09123456789" autoComplete="tel" required />
        </div>
      </Label>
      <Label>
        ایمیل اختیاری
        <div className="relative">
          <Mail className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <Input className="pr-11" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" />
        </div>
      </Label>
      <Label>
        رمز عبور
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <Input className="px-11" value={form.password} onChange={(event) => update("password", event.target.value)} type={showPassword ? "text" : "password"} dir="ltr" minLength={8} autoComplete="new-password" required />
          <Button type="button" variant="ghost" size="iconSm" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </Button>
        </div>
        <FieldHint>حداقل ۸ کاراکتر؛ ترجیحاً شامل عدد و حروف انگلیسی.</FieldHint>
      </Label>
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={loading} loadingText="در حال ساخت حساب...">ساخت حساب کاربری</Button>
    </form>
  );
}
