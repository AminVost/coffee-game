import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { queryRows } from "@/lib/db";

type MatchRow = RowDataPacket & {
  id: number;
  tournament_title: string;
  round_title: string | null;
  resource_id: number | null;
  resource_title: string | null;
  status: string;
  scheduled_at: Date | null;
  duration_min: number | null;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  referee_user_id: number | null;
  referee_name: string | null;
  notes: string | null;
};

type OptionRow = RowDataPacket & { id: number; title: string };
type UserOptionRow = RowDataPacket & { id: number; name: string };

export async function GET() {
  const auth = await authorize("results.submit");
  if (auth.response) return auth.response;

  const canManageAll = hasPermission(auth.user, "matches.manage");
  const params: Array<string | number> = [];
  const refereeFilter = canManageAll ? "" : "AND m.referee_user_id=?";
  if (!canManageAll) params.push(auth.user.id);

  const rows = await queryRows<MatchRow[]>(`
    SELECT m.id,t.title AS tournament_title,tr.title AS round_title,m.resource_id,res.title AS resource_title,
           m.status,m.scheduled_at,m.duration_min,m.home_score,m.away_score,m.referee_user_id,referee.name AS referee_name,m.notes,
           COALESCE(home_team.title,home_player.name) AS home_name,
           COALESCE(away_team.title,away_player.name) AS away_name
    FROM tournament_matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
    LEFT JOIN resources res ON res.id=m.resource_id
    LEFT JOIN users referee ON referee.id=m.referee_user_id
    LEFT JOIN match_participants home_mp ON home_mp.match_id=m.id AND home_mp.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_mp.team_id
    LEFT JOIN players home_player ON home_player.id=home_mp.player_id
    LEFT JOIN match_participants away_mp ON away_mp.match_id=m.id AND away_mp.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_mp.team_id
    LEFT JOIN players away_player ON away_player.id=away_mp.player_id
    WHERE t.deleted_at IS NULL ${refereeFilter}
    ORDER BY FIELD(m.status,'LIVE','READY','PENDING','POSTPONED','COMPLETED','CANCELLED'),m.scheduled_at DESC,m.id DESC
    LIMIT 300
  `, params);

  const [resources, referees] = canManageAll ? await Promise.all([
    queryRows<OptionRow[]>(`SELECT id,title FROM resources WHERE is_active=1 AND status='available' ORDER BY title`),
    queryRows<UserOptionRow[]>(`
      SELECT DISTINCT u.id,u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id=u.id
      JOIN roles r ON r.id=ur.role_id
      WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND r.name IN ('referee','operator','manager','super_admin')
      ORDER BY u.name
    `)
  ]) : [[], []];

  return NextResponse.json({
    canManageAll,
    resources: resources.map((row) => ({ id: String(row.id), title: row.title })),
    referees: referees.map((row) => ({ id: String(row.id), title: row.name })),
    items: rows.map((row) => ({
      id: String(row.id),
      tournament: row.tournament_title,
      round: row.round_title || "مرحله مسابقه",
      resourceId: row.resource_id ? String(row.resource_id) : null,
      resource: row.resource_title || "بدون تخصیص",
      status: row.status,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      durationMin: row.duration_min,
      home: row.home_name || "در انتظار",
      away: row.away_name || "در انتظار",
      homeScore: row.home_score,
      awayScore: row.away_score,
      refereeUserId: row.referee_user_id ? String(row.referee_user_id) : null,
      referee: row.referee_name || null,
      notes: row.notes || ""
    }))
  });
}
