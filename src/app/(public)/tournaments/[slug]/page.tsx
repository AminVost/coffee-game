import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Share2,
  Trophy,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RegisterTournamentForm } from "@/components/forms/register-tournament-form";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import { findTournament } from "@/lib/repositories/tournaments";
import { formatToman } from "@/lib/utils";


type TournamentMatchRow = RowDataPacket & {
  id: number;
  match_number: number;
  status: string;
  scheduled_at: Date | null;
  round_title: string | null;
  resource_title: string | null;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

export default async function TournamentDetail({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, user] = await Promise.all([
    findTournament(slug),
    getSession()
  ]);

  if (!item) notFound();

  const matches = await queryRows<TournamentMatchRow[]>(`
    SELECT
      m.id,m.match_number,m.status,m.scheduled_at,
      tr.title AS round_title,res.title AS resource_title,
      COALESCE(home_team.title,home_player.name) AS home_name,
      COALESCE(away_team.title,away_player.name) AS away_name,
      m.home_score,m.away_score
    FROM tournament_matches m
    LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
    LEFT JOIN resources res ON res.id=m.resource_id
    LEFT JOIN match_participants home_participant
      ON home_participant.match_id=m.id AND home_participant.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_participant.team_id
    LEFT JOIN players home_player ON home_player.id=home_participant.player_id
    LEFT JOIN match_participants away_participant
      ON away_participant.match_id=m.id AND away_participant.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_participant.team_id
    LEFT JOIN players away_player ON away_player.id=away_participant.player_id
    WHERE m.tournament_id=?
    ORDER BY m.match_number ASC,m.id ASC
    LIMIT 200
  `, [Number(item.id)]);

  const left = Math.max(0, item.capacity - item.registered);

  return (
    <div className="page-shell">
      <div
        className="overflow-hidden rounded-[2.5rem] p-7 text-white sm:p-12"
        style={{ background: item.cover }}
      >
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-black/30 text-white">{item.status}</Badge>
            <Badge className="border-white/15 bg-black/30 text-white">{item.gameTitle}</Badge>
            <Badge className="border-white/15 bg-black/30 text-white">{item.format}</Badge>
          </div>
          <h1 className="mt-6 text-3xl font-black sm:text-5xl">{item.title}</h1>
          <p className="mt-4 max-w-2xl leading-8 text-white/75">{item.description}</p>
          <div className="mt-7 flex flex-wrap gap-4 text-sm font-bold">
            <span className="flex items-center gap-2"><CalendarDays size={17} />{item.date}</span>
            <span className="flex items-center gap-2"><Clock3 size={17} />{item.time}</span>
            <span className="flex items-center gap-2"><MapPin size={17} />{item.venue}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-black">اطلاعات مسابقه</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info
                icon={<Users />}
                title="ظرفیت"
                value={`${item.registered.toLocaleString("fa-IR")} از ${item.capacity.toLocaleString("fa-IR")} نفر`}
              />
              <Info icon={<Trophy />} title="جایزه" value={item.prize} />
              <Info icon={<Clock3 />} title="نوع شرکت" value={item.participantMode} />
              <Info icon={<MapPin />} title="محل" value={item.venue} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-black">قوانین اصلی</h2>
            <div className="mt-5 grid gap-3">
              {item.rules.map((rule) => (
                <div
                  key={rule}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-bold"
                >
                  <Check size={17} className="text-[var(--brand)]" />
                  {rule}
                </div>
              ))}
            </div>
            <Button href="/rules" variant="ghost" className="mt-4">مشاهده قوانین کامل</Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-black">جدول و بازی‌ها</h2>
            {matches.length ? <div className="mt-5 grid gap-3">
              {matches.map((match) => (
                <div key={match.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                    <span>{match.round_title || `بازی ${match.match_number.toLocaleString("fa-IR")}`}</span>
                    <span>{match.resource_title || "محل بازی اعلام نشده"}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 font-black">
                    <span>{match.home_name || "در انتظار تعیین"}</span>
                    <span className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">
                      {match.home_score === null || match.away_score === null
                        ? "—"
                        : `${match.home_score.toLocaleString("fa-IR")} - ${match.away_score.toLocaleString("fa-IR")}`}
                    </span>
                    <span>{match.away_name || "در انتظار تعیین"}</span>
                  </div>
                  {match.scheduled_at && <time className="mt-3 block text-center text-xs text-[var(--muted)]">
                    {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(match.scheduled_at))}
                  </time>}
                </div>
              ))}
            </div> : <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              هنوز قرعه یا بازی زمان‌بندی‌شده‌ای برای این مسابقه ثبت نشده است.
            </p>}
          </Card>
        </div>

        <aside className="grid h-fit gap-5 lg:sticky lg:top-24">
          <Card className="p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[var(--muted)]">هزینه ثبت‌نام هر نفر</p>
                <strong className="mt-1 block text-xl">{formatToman(item.price)}</strong>
              </div>
              <span className="text-sm font-black text-[var(--brand)]">
                {left.toLocaleString("fa-IR")} ظرفیت باقی‌مانده
              </span>
            </div>
            <div className="my-5 h-px bg-[var(--line)]" />
            <RegisterTournamentForm
              tournament={item}
              initialUser={user ? { name: user.name, mobile: user.mobile } : null}
            />
          </Card>
          <Button variant="secondary"><Share2 size={17} />اشتراک‌گذاری مسابقه</Button>
        </aside>
      </div>
    </div>
  );
}

function Info({
  icon,
  title,
  value
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[var(--line)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)]">
        {icon}
      </span>
      <div>
        <p className="text-xs text-[var(--muted)]">{title}</p>
        <strong className="mt-1 block text-sm">{value}</strong>
      </div>
    </div>
  );
}
