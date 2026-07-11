import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, CheckCircle2, Gamepad2, Radio, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { LiveMatchCard } from "@/components/live-match-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listTournaments } from "@/lib/repositories/tournaments";
import { listLiveMatches } from "@/lib/repositories/live";
import { getPageContent } from "@/lib/repositories/content";

export default async function HomePage() {
  const [tournaments, liveMatches, homeContent] = await Promise.all([listTournaments(), listLiveMatches(), getPageContent("home")]);
  const featured = tournaments.find((item) => item.featured) || tournaments[0];
  return <>
    <section className="relative overflow-hidden border-b border-[var(--line)]">
      <div className="hero-grid absolute inset-0"/><div className="glow -right-28 top-4 bg-emerald-500"/><div className="glow -left-24 bottom-0 bg-amber-400"/>
      <div className="container-shell relative grid min-h-[650px] items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr]">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-500"><Sparkles size={15}/>رقابت حرفه‌ای، بدون کارهای دستی</span><h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.35] tracking-[-.05em] sm:text-6xl">مسابقه را رزرو کن،<br/><span className="text-[var(--brand)]">قرعه را زنده ببین</span> و قهرمان شو.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">{homeContent?.body || "سامانه رسمی مسابقات FC 26 و تخته‌نرد Coffee Game ستارخان."}</p><div className="mt-8 flex flex-wrap gap-3"><Button href="/tournaments" size="lg"><Trophy size={19}/>مشاهده مسابقات</Button><Button href="/live" size="lg" variant="secondary"><Radio size={19}/>نتایج زنده</Button></div><div className="mt-10 flex flex-wrap gap-6 text-sm font-bold text-[var(--muted)]"><span className="flex items-center gap-2"><ShieldCheck className="text-[var(--brand)]" size={18}/>رزرو امن</span><span className="flex items-center gap-2"><CalendarCheck className="text-[var(--brand)]" size={18}/>زمان‌بندی هوشمند</span><span className="flex items-center gap-2"><Gamepad2 className="text-[var(--brand)]" size={18}/>مناسب موبایل</span></div></div>
        <div className="relative mx-auto w-full max-w-[520px]"><div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-emerald-500/20 to-amber-500/10 blur-2xl"/><Card className="relative overflow-hidden p-3"><Image src="/brand/logo-dark.png" alt="لوگوی Coffee Game ستارخان" width={900} height={700} className="aspect-[1.2] w-full rounded-[1.35rem] object-cover" priority/><div className="grid grid-cols-3 gap-2 p-2 text-center"><div className="rounded-2xl bg-[var(--surface-2)] p-3"><strong className="block text-xl">۱۰</strong><span className="text-xs text-[var(--muted)]">PS5</span></div><div className="rounded-2xl bg-[var(--surface-2)] p-3"><strong className="block text-xl">۵</strong><span className="text-xs text-[var(--muted)]">میز نرد</span></div><div className="rounded-2xl bg-[var(--surface-2)] p-3"><strong className="block text-xl">۲۴/۷</strong><span className="text-xs text-[var(--muted)]">مشاهده نتایج</span></div></div></Card></div>
      </div>
    </section>

    <section className="page-shell"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="section-kicker">UPCOMING TOURNAMENTS</p><h2 className="section-title mt-2">مسابقات پیش‌رو</h2><p className="mt-2 text-sm text-[var(--muted)]">ظرفیت‌ها محدود است؛ رزرو خود را زودتر قطعی کنید.</p></div><Link href="/tournaments" className="hidden items-center gap-1 text-sm font-black text-[var(--brand)] sm:flex">همه مسابقات <ArrowLeft size={17}/></Link></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{tournaments.slice(0,3).map((item)=><TournamentCard key={item.id} tournament={item}/>)}</div></section>

    <section className="border-y border-[var(--line)] bg-[var(--surface)]"><div className="page-shell"><div className="mb-8 flex items-end justify-between"><div><p className="section-kicker">LIVE CENTER</p><h2 className="section-title mt-2">مرکز مسابقات زنده</h2></div><Button href="/live" variant="secondary" size="sm">نمایشگر زنده</Button></div><div className="grid gap-4 lg:grid-cols-2">{liveMatches.slice(0,4).map((match)=><LiveMatchCard key={match.id} match={match}/>)}</div></div></section>

    <section className="page-shell"><div className="grid gap-6 lg:grid-cols-3"><Card className="p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-500"><Users/></span><h3 className="mt-5 text-lg font-black">ثبت‌نام فردی و تیمی</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">یک یا چند سهم بخرید، اعضای تیم را دعوت کنید و اطلاعات مهمان‌ها را مدیریت کنید.</p></Card><Card className="p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/12 text-amber-500"><Sparkles/></span><h3 className="mt-5 text-lg font-black">قرعه‌کشی خودکار و دستی</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">قرعه تصادفی، Seed شده یا کاملاً سفارشی با نمایش زنده و جذاب روی موبایل و نمایشگر.</p></Card><Card className="p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/12 text-sky-500"><CheckCircle2/></span><h3 className="mt-5 text-lg font-black">نتایج و رنکینگ مستقل</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">رنکینگ FC 26 و تخته‌نرد جداست و امتیازهای ماهانه، فصلی و سالانه را پوشش می‌دهد.</p></Card></div></section>

    {featured && <section className="container-shell mb-20 overflow-hidden rounded-[2.5rem] border border-[var(--line)] p-8 sm:p-12" style={{background:featured.cover}}><div className="max-w-2xl text-white"><span className="rounded-full bg-black/30 px-4 py-2 text-xs font-black">پیشنهاد ویژه</span><h2 className="mt-6 text-3xl font-black sm:text-4xl">{featured.title}</h2><p className="mt-4 leading-8 text-white/75">{featured.description}</p><Button href={`/tournaments/${featured.slug}`} className="mt-7 bg-white text-black hover:bg-white/90">مشاهده و رزرو <ArrowLeft size={18}/></Button></div></section>}
  </>;
}
