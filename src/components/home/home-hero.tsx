"use client";

import Image from "next/image";
import { m, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  Gamepad2,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";

export function HomeHero({
  featured,
  body
}: {
  featured?: Tournament;
  body: string;
}) {
  const reduceMotion = useReducedMotion();
  const percentage = featured
    ? Math.min(100, Math.round((featured.registered / Math.max(featured.capacity, 1)) * 100))
    : 0;

  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--line)]">
      <div className="hero-grid absolute inset-0 -z-20" />
      <div className="hero-noise absolute inset-0 -z-10" />
      <m.div
        aria-hidden="true"
        className="absolute -right-36 top-4 -z-10 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-[120px]"
        animate={reduceMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <m.div
        aria-hidden="true"
        className="absolute -left-32 bottom-0 -z-10 h-[380px] w-[380px] rounded-full bg-amber-400/15 blur-[115px]"
        animate={reduceMotion ? undefined : { x: [0, 16, 0], y: [0, -12, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container-shell grid min-h-[720px] items-center gap-14 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <m.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-500 shadow-sm backdrop-blur">
            <Sparkles size={15} />
            مسابقه، رزرو و نتیجه در یک تجربه روان
          </span>

          <h1 className="mt-7 max-w-3xl text-[clamp(2.45rem,6vw,5rem)] font-black leading-[1.2] tracking-[-.065em]">
            رقابت را شروع کن،
            <span className="mt-1 block bg-gradient-to-l from-[var(--brand)] via-emerald-400 to-amber-400 bg-clip-text text-transparent">
              بقیه‌اش با ما.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg sm:leading-9">
            {body}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/tournaments" size="lg">
              <Trophy size={19} />
              مشاهده مسابقات
              <ArrowLeft size={17} />
            </Button>
            <Button href="/live" size="lg" variant="secondary">
              <Radio size={19} />
              نتایج زنده
            </Button>
          </div>

          <div className="mt-11 grid max-w-2xl grid-cols-1 gap-3 text-sm font-bold text-[var(--muted)] sm:grid-cols-3">
            <span className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/70 px-3.5 py-3 backdrop-blur">
              <ShieldCheck className="text-[var(--brand)]" size={18} />
              رزرو و پرداخت امن
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/70 px-3.5 py-3 backdrop-blur">
              <Users className="text-[var(--brand)]" size={18} />
              فردی و تیمی
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/70 px-3.5 py-3 backdrop-blur">
              <Gamepad2 className="text-[var(--brand)]" size={18} />
              بهینه برای موبایل
            </span>
          </div>
        </m.div>

        <m.div
          initial={{ opacity: 0, scale: 0.96, x: -24 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.68, delay: 0.12 }}
          className="relative mx-auto w-full max-w-[560px]"
        >
          <m.div
            className="glass-panel relative overflow-hidden rounded-[2rem] p-4 sm:p-5"
            animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

            <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/8 bg-black/90 p-4 text-white">
              <div className="flex items-center gap-3">
                <Image
                  src="/icons/icon-192.png"
                  alt="Coffee Game ستارخان"
                  width={52}
                  height={52}
                  className="rounded-2xl border border-white/10 object-cover"
                  priority
                />
                <div>
                  <strong className="block text-sm font-black tracking-wide">COFFEE GAME</strong>
                  <span className="text-xs font-bold text-emerald-400">ستارخان</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/12 px-3 py-2 text-xs font-black text-emerald-300">
                <span className="live-pulse relative h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" />
                سیستم آنلاین
              </span>
            </div>

            <div className="mt-4 rounded-[1.65rem] bg-gradient-to-br from-[#0c7f4b] via-[#10231a] to-[#8a6718] p-[1px]">
              <div className="rounded-[calc(1.65rem-1px)] bg-[#09120e]/94 p-5 text-white sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white/55">مسابقه پیشنهادی</span>
                    <h2 className="mt-2 text-xl font-black leading-8 sm:text-2xl">
                      {featured?.title || "جام هفتگی Coffee Game"}
                    </h2>
                  </div>
                  <span className="rounded-xl bg-white/8 px-3 py-2 text-xs font-bold text-emerald-300">
                    {featured?.gameTitle || "FC 26"}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 text-xs text-white/65 sm:grid-cols-2">
                  <span className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-3">
                    <CalendarDays size={16} className="text-emerald-300" />
                    {featured ? `${featured.date}، ${featured.time}` : "جمعه ساعت ۲۰:۰۰"}
                  </span>
                  <span className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-3">
                    <MapPin size={16} className="text-amber-300" />
                    {featured?.venue || "Coffee Game ستارخان"}
                  </span>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/60">
                      <Users size={15} />
                      {featured?.registered.toLocaleString("fa-IR") || "۰"} ثبت‌نام
                    </span>
                    <span className="font-black text-white">
                      {featured ? `${Math.max(0, featured.capacity - featured.registered).toLocaleString("fa-IR")} جای خالی` : "ظرفیت محدود"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                    <m.span
                      className="block h-full rounded-full bg-gradient-to-l from-emerald-400 to-amber-300"
                      initial={{ width: 0 }}
                      animate={{ width: `${featured ? percentage : 36}%` }}
                      transition={{ delay: 0.55, duration: 0.9 }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/8 pt-5">
                  <span className="text-xs text-white/55">هزینه ورودی</span>
                  <strong className="text-base text-emerald-300">
                    {featured ? (featured.price ? formatToman(featured.price) : "رایگان") : "۳۵۰٬۰۰۰ تومان"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["۱۰", "PS5"],
                ["۵", "میز نرد"],
                ["۲۴/۷", "نتایج"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-2 py-3">
                  <strong className="block text-lg font-black">{value}</strong>
                  <span className="text-[11px] font-semibold text-[var(--muted)]">{label}</span>
                </div>
              ))}
            </div>
          </m.div>

          <m.div
            aria-hidden="true"
            className="absolute -left-3 top-16 hidden rounded-2xl border border-amber-400/20 bg-[#161208]/90 px-4 py-3 text-xs font-black text-amber-300 shadow-xl backdrop-blur sm:block"
            animate={reduceMotion ? undefined : { y: [0, 8, 0], rotate: [-1, 1, -1] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          >
            قرعه‌کشی زنده
          </m.div>
        </m.div>
      </div>
    </section>
  );
}
