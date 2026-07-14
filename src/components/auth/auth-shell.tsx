import Link from "next/link";
import { ArrowRight, Gamepad2, Radio, ShieldCheck, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/layout/logo";

export function AuthShell({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--bg)] p-3 sm:p-5">
      <div className="hero-grid absolute inset-0 -z-20 opacity-70" />
      <div className="hero-noise absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute -right-32 -top-24 -z-10 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-36 -left-28 -z-10 h-[400px] w-[400px] rounded-full bg-amber-400/15 blur-[120px]"
      />

      <div className="mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-float)] lg:grid-cols-[.93fr_1.07fr] sm:min-h-[calc(100vh-40px)]">
        <section
          className="flex flex-col p-6 sm:p-9 lg:p-12"
        >
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <ThemeToggle />
          </div>

          <div className="my-auto py-12 lg:py-8">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand)]">
              <ArrowRight size={16} />
              بازگشت به سایت
            </Link>
            <h1 className="mt-7 text-3xl font-black leading-tight tracking-[-.04em] sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-7 text-center text-sm text-[var(--muted)]">{footer}</div>
          </div>
        </section>

        <aside
          className="relative hidden overflow-hidden bg-[#07110c] p-9 text-white lg:flex lg:flex-col"
        >
          <div className="hero-grid absolute inset-0 opacity-40" />
          <div className="hero-noise absolute inset-0" />
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-400/15 blur-[100px]" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-[110px]" />

          <div className="relative flex h-full flex-col">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-emerald-300 backdrop-blur">
              <Radio size={15} />
              مرکز رقابت Coffee Game
            </span>

            <div className="my-auto">
              <div
                className="rounded-[2rem] border border-white/10 bg-white/[.055] p-5 shadow-2xl backdrop-blur-xl"
              >
                <div className="border-b border-white/8 pb-4">
                  <span className="text-xs font-bold text-white/45">حساب یکپارچه بازیکن</span>
                  <h2 className="mt-1 text-xl font-black">ثبت‌نام، پرداخت و پیگیری در یک مسیر</h2>
                </div>
                <div className="mt-5 grid gap-3 text-sm leading-7 text-white/65">
                  <p>با شماره موبایل خود وارد شوید و ثبت‌نام‌ها و پرداخت‌های متصل به همان شماره را مشاهده کنید.</p>
                  <p>وضعیت هر مسابقه و پیام‌های مدیر بدون نیاز به پیگیری تلفنی در حساب شما ثبت می‌شود.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  [ShieldCheck, "ورود امن"],
                  [Gamepad2, "تجربه موبایل"],
                  [Trophy, "رنکینگ مستقل"]
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[.035] p-4 text-center">
                      <ItemIcon className="mx-auto text-emerald-300" size={21} />
                      <span className="mt-2 block text-xs font-bold text-white/65">{String(label)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="relative text-xs leading-6 text-white/35">رزرو، قرعه‌کشی، Check-in و نتیجه زنده؛ ساده و یکپارچه.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
