import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { liveMatches } from "@/data/mock-data";

type MatchRow = RowDataPacket & {
  id: number;
  tournament_title: string;
  round_title: string | null;
  resource_title: string | null;
  status: string;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  referee_user_id: number | null;
};

export async function GET() {
  const auth = await authorize("results.submit");
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({ items: liveMatches.map((item) => ({ ...item, refereeUserId: null })) });
  }

  const canManageAll = hasPermission(auth.user, "matches.manage");
  const params: Array<string | number> = [];
  const refereeFilter = canManageAll ? "" : "AND m.referee_user_id=?";
  if (!canManageAll) params.push(auth.user.id);

  const rows = await queryRows<MatchRow[]>(`
    SELECT m.id,t.title AS tournament_title,tr.title AS round_title,res.title AS resource_title,
           m.status,m.home_score,m.away_score,m.referee_user_id,
           COALESCE(home_team.title,home_player.name) AS home_name,
           COALESCE(away_team.title,away_player.name) AS away_name
    FROM tournament_matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
    LEFT JOIN resources res ON res.id=m.resource_id
    LEFT JOIN match_participants home_mp ON home_mp.match_id=m.id AND home_mp.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_mp.team_id
    LEFT JOIN players home_player ON home_player.id=home_mp.player_id
    LEFT JOIN match_participants away_mp ON away_mp.match_id=m.id AND away_mp.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_mp.team_id
    LEFT JOIN players away_player ON away_player.id=away_mp.player_id
    WHERE t.deleted_at IS NULL ${refereeFilter}
    ORDER BY FIELD(m.status,'LIVE','READY','PENDING','COMPLETED','POSTPONED','CANCELLED'),m.scheduled_at DESC,m.id DESC
    LIMIT 200
  `, params);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      tournament: row.tournament_title,
      round: row.round_title || "مرحله مسابقه",
      resource: row.resource_title || "بدون تخصیص",
      status: row.status,
      home: row.home_name || "در انتظار",
      away: row.away_name || "در انتظار",
      homeScore: row.home_score,
      awayScore: row.away_score,
      refereeUserId: row.referee_user_id ? String(row.referee_user_id) : null
    }))
  });
}
