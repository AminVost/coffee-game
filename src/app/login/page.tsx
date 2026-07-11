import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="خوش آمدی؛ آماده رقابتی؟"
      description="با رمز عبور یا کد یک‌بارمصرف وارد حساب خودت شو و مسابقه‌ها، تیم‌ها و پرداخت‌هایت را مدیریت کن."
      footer={<>حساب نداری؟ <Link href="/register" className="font-black text-[var(--brand)]">ساخت حساب کاربری</Link></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
