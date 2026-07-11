import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/forms/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="حساب مسابقه‌ات را بساز"
      description="با یک حساب می‌توانی برای خودت یا دوستانت رزرو انجام بدهی، تیم بسازی و سابقه مسابقاتت را نگه داری."
      footer={<>قبلاً ثبت‌نام کرده‌ای؟ <Link href="/login" className="font-black text-[var(--brand)]">ورود به حساب</Link></>}
    >
      <RegisterForm />
    </AuthShell>
  );
}
