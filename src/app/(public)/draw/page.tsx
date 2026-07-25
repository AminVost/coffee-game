import Link from "next/link";
import { Shuffle } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { TournamentBracket } from "@/components/tournament-bracket";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

export const dynamic = "force-dynamic";

type TournamentOption = RowDataPacket & { id: number; title: string; slug: string; status: string };
type DrawRow = RowDataPacket & {
  tournament_id: number;
  tournament_title: string;
  round_id: number;
  round_title: string;
  round_number: number;
  stage: string;
  match_id: number;
  match_number: number;
  status: string;
  scheduled_at: Date | null;
  home_score: number | null;
  away_score: number | null;
  home_name: string | null;
  away_name: string | null;
  home_seed: number | null;
  away_seed: number | null;
};

export default async function Draw({ searchParams }: { searchParams: Promise<{ tournament?: string }> }) {
  const requested = (await searchParams).tournament;
  const tournaments = await queryRows<TournamentOption[]>(`
    SELECT tournament.id,tournament.title,tournament.slug,tournament.status
    FROM tournaments tournament
    WHERE tournament.deleted_at IS NULL
      AND tournament.status IN ('DRAW_READY','RUNNING','COMPLETED')
      AND EXISTS(SELECT 1 FROM tournament_matches match_row WHERE match_row.tournament_id=tournament.id)
    ORDER BY FIELD(tournament.status,'RUNNING','DRAW_READY','COMPLETED'),tournament.starts_at DESC,tournament.id DESC
    LIMIT 30
  `);
  const selected = tournaments.find((tournament) => String(tournament.id) === requested || tournament.slug === requested) || tournaments[0];
  const rows = selected ? await queryRows<DrawRow[]>(`
    SELECT tournament.id AS tournament_id,tournament.title AS tournament_title,
      round.id AS round_id,round.title AS round_title,round.round_number,round.stage,
      match_row.id AS match_id,match_row.match_number,match_row.status,match_row.scheduled_at,
      match_row.home_score,match_row.away_score,
      COALESCE(home_team.title,home_player.name) AS home_name,
      COALESCE(away_team.title,away_player.name) AS away_name,
      home.seed AS home_seed,away.seed AS away_seed
    FROM tournaments tournament
    JOIN tournament_rounds round ON round.tournament_id=tournament.id
    JOIN tournament_matches match_row ON match_row.round_id=round.id
    LEFT JOIN match_participants home ON home.match_id=match_row.id AND home.slot=1
    LEFT JOIN teams home_team ON home_team.id=home.team_id
    LEFT JOIN players home_player ON home_player.id=home.player_id
    LEFT JOIN match_participants away ON away.match_id=match_row.id AND away.slot=2
    LEFT JOIN teams away_team ON away_team.id=away.team_id
    LEFT JOIN players away_player ON away_player.id=away.player_id
    WHERE tournament.id=?
    ORDER BY round.round_number,round.stage,match_row.match_number
  `, [selected.id]) : [];

  const matches = rows.map((match) => ({
    roundId: Number(match.round_id),
    roundTitle: match.round_title,
    roundNumber: Number(match.round_number),
    stage: match.stage,
    matchId: Number(match.match_id),
    matchNumber: Number(match.match_number),
    status: match.status,
    scheduledAt: match.scheduled_at ? new Date(match.scheduled_at).toISOString() : null,
    homeScore: match.home_score === null ? null : Number(match.home_score),
    awayScore: match.away_score === null ? null : Number(match.away_score),
    homeName: match.home_name,
    awayName: match.away_name,
    homeSeed: match.home_seed === null ? null : Number(match.home_seed),
    awaySeed: match.away_seed === null ? null : Number(match.away_seed)
  }));

  return <div className="page-shell">
    <p className="section-kicker">LIVE DRAW</p>
    <h1 className="section-title mt-2">قرعه و براکت مسابقات</h1>
    {tournaments.length > 1 && <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{tournaments.map((tournament) => <Link key={tournament.id} href={`/draw?tournament=${tournament.id}`} className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold ${selected?.id === tournament.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}>{tournament.title}</Link>)}</div>}
    {selected && <div className="mt-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)]"><Shuffle size={18}/></span><div><h2 className="font-black">{selected.title}</h2><p className="text-xs text-[var(--muted)]">{selected.status}</p></div></div>}
    <Card className="mt-6 p-4 sm:p-7">
      {matches.length ? <TournamentBracket matches={matches}/> : <div className="p-10 text-center text-[var(--muted)]">هنوز قرعه‌ای برای نمایش ساخته نشده است.</div>}
    </Card>
  </div>;
}
