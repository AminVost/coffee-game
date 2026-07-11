import type { RowDataPacket } from "mysql2";
import { liveMatches as mockLiveMatches } from "@/data/mock-data";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import type { LiveMatch } from "@/types";

type LiveMatchRow = RowDataPacket & {
  id: number;
  tournament_title: string;
  round_title: string | null;
  resource_title: string | null;
  status: string;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  scheduled_at: Date | null;
};

function mapStatus(status: string): LiveMatch["status"] {
  if (status === "LIVE") return "LIVE";
  if (status === "COMPLETED") return "DONE";
  return "NEXT";
}

function mapStartsAt(row: LiveMatchRow) {
  if (row.status === "LIVE") return "اکنون";
  if (row.status === "COMPLETED") return "پایان‌یافته";
  if (!row.scheduled_at) return "زمان اعلام می‌شود";
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(row.scheduled_at));
}

export async function listLiveMatches(): Promise<LiveMatch[]> {
  if (env.dataMode === "mock") return mockLiveMatches;

  const rows = await queryRows<LiveMatchRow[]>(`
    SELECT m.id,t.title AS tournament_title,tr.title AS round_title,
           res.title AS resource_title,m.status,m.home_score,m.away_score,m.scheduled_at,
           COALESCE(team_home.title,player_home.name) AS home_name,
           COALESCE(team_away.title,player_away.name) AS away_name
    FROM tournament_matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
    LEFT JOIN resources res ON res.id=m.resource_id
    LEFT JOIN match_participants mp_home ON mp_home.match_id=m.id AND mp_home.slot=1
    LEFT JOIN teams team_home ON team_home.id=mp_home.team_id
    LEFT JOIN players player_home ON player_home.id=mp_home.player_id
    LEFT JOIN match_participants mp_away ON mp_away.match_id=m.id AND mp_away.slot=2
    LEFT JOIN teams team_away ON team_away.id=mp_away.team_id
    LEFT JOIN players player_away ON player_away.id=mp_away.player_id
    WHERE m.status IN ('READY','LIVE','COMPLETED')
      AND t.deleted_at IS NULL
      AND (m.status<>'COMPLETED' OR m.completed_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR))
    ORDER BY FIELD(m.status,'LIVE','READY','COMPLETED'),m.scheduled_at ASC,m.id ASC
    LIMIT 100
  `);

  return rows.map((row) => ({
    id: String(row.id),
    tournament: row.tournament_title,
    round: row.round_title || "مرحله مسابقه",
    resource: row.resource_title || "منبع اعلام نشده",
    status: mapStatus(row.status),
    home: row.home_name || "در انتظار",
    away: row.away_name || "در انتظار",
    homeScore: row.home_score === null ? undefined : Number(row.home_score),
    awayScore: row.away_score === null ? undefined : Number(row.away_score),
    startsAt: mapStartsAt(row)
  }));
}
