import Link from "next/link";
import { ArrowLeft, CheckCircle2, Radio, Sparkles, Trophy, Users } from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { TournamentCard } from "@/components/tournament-card";
import { LiveMatchCard } from "@/components/live-match-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { listTournaments } from "@/lib/repositories/tournaments";
import { listLiveMatches } from "@/lib/repositories/live";
import { getPageContent } from "@/lib/repositories/content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [tournaments, liveMatches, homeContent] = await Promise.all([
    listTournaments(),
    listLiveMatches(),
    getPageContent("home")
  ]);
  const featured = tournaments.find((item) => item.featured) || tournaments[0];

  return (
    <>
      <HomeHero
        featured={featured}
        body={homeContent?.body || "سامانه رسمی مسابقات FC 26 و تخته‌نرد Coffee Game ستارخان؛ از ثبت‌نام تا قرعه، زمان‌بندی و نتیجه زنده."}
      />

      <Reveal className="page-shell">
        <div className="mb-9 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">UPCOMING TOURNAMENTS</p>
            <h2 className="section-title mt-2">مسابقات پیش‌رو</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">ظرفیت‌ها محدود است؛ رزرو خود را زودتر قطعی کنید.</p>
          </div>
          <Link href="/tournaments" className="hidden items-center gap-1 text-sm font-black text-[var(--brand)] sm:flex">
            همه مسابقات <ArrowLeft size={17} />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.slice(0, 3).map((item) => <TournamentCard key={item.id} tournament={item} />)}
        </div>
      </Reveal>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]/70 backdrop-blur">
        <Reveal className="page-shell">
          <div className="mb-9 flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">LIVE CENTER</p>
              <h2 className="section-title mt-2">مرکز مسابقات زنده</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">نتیجه، میز بازی و وضعیت هر مسابقه را لحظه‌ای دنبال کنید.</p>
            </div>
            <Button href="/live" variant="secondary" size="sm">
              <Radio size={16} />
              نمایشگر زنده
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {liveMatches.slice(0, 4).map((match) => <LiveMatchCard key={match.id} match={match} />)}
          </div>
        </Reveal>
      </section>

      <Reveal className="page-shell">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: Users,
              title: "ثبت‌نام فردی و تیمی",
              text: "یک یا چند سهم بخرید، اعضای تیم را دعوت کنید و اطلاعات مهمان‌ها را بدون سردرگمی مدیریت کنید.",
              tone: "bg-emerald-500/12 text-emerald-500"
            },
            {
              icon: Sparkles,
              title: "قرعه‌کشی منعطف",
              text: "قرعه تصادفی، Seed شده یا کاملاً سفارشی با نمایش جذاب روی موبایل و نمایشگر مجموعه.",
              tone: "bg-amber-500/12 text-amber-500"
            },
            {
              icon: CheckCircle2,
              title: "نتایج و رنکینگ مستقل",
              text: "رنکینگ FC 26 و تخته‌نرد جداست و امتیازهای ماهانه، فصلی و سالانه را پوشش می‌دهد.",
              tone: "bg-sky-500/12 text-sky-500"
            }
          ].map(({ icon: Icon, title, text, tone }) => (
            <Card key={title} className="group p-6 transition-transform duration-300 hover:-translate-y-1">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon /></span>
              <h3 className="mt-5 text-lg font-black">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{text}</p>
            </Card>
          ))}
        </div>
      </Reveal>

      {featured && (
        <Reveal className="container-shell mb-20">
          <section className="relative overflow-hidden rounded-[2.5rem] border border-[var(--line)] p-8 shadow-[var(--shadow-card)] sm:p-12" style={{ background: featured.cover }}>
            <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/35 to-transparent" />
            <div className="relative max-w-2xl text-white">
              <span className="rounded-full border border-white/12 bg-black/25 px-4 py-2 text-xs font-black backdrop-blur">پیشنهاد ویژه</span>
              <h2 className="mt-6 text-3xl font-black leading-tight sm:text-4xl">{featured.title}</h2>
              <p className="mt-4 leading-8 text-white/75">{featured.description}</p>
              <Button href={`/tournaments/${featured.slug}`} className="mt-7 bg-white text-black shadow-xl hover:bg-white/90">
                <Trophy size={18} />
                مشاهده و رزرو
                <ArrowLeft size={18} />
              </Button>
            </div>
          </section>
        </Reveal>
      )}
    </>
  );
}
