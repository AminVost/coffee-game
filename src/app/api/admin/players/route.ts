import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";

const querySchema = z.object({
  search: z.string().trim().max(120).default(""),
  type: z.enum(["all", "member", "guest"]).default("all"),
  status: z.enum(["all", "ACTIVE", "PENDING", "SUSPENDED", "GUEST"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20)
});

type CountRow = RowDataPacket & { total: number };
type OverviewRow = RowDataPacket & {
  total: number;
  members: number;
  guests: number;
  active_accounts: number;
};

type PlayerRow = RowDataPacket & {
  id: number;
  user_id: number | null;
  name: string;
  mobile: string | null;
  avatar_url: string | null;
  is_guest: number;
  created_at: Date;
  updated_at: Date;
  email: string | null;
  account_status: string | null;
  mobile_verified: number | null;
  email_verified: number | null;
  registration_count: number;
  tournament_count: number;
  team_count: number;
  total_points: string | number;
  ranking_played: number;
  ranking_wins: number;
  last_tournament_title: string | null;
  last_registration_at: Date | null;
};

export async function GET(request: Request) {
  const auth = await authorize("players.view");
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const where: string[] = ["1=1"];
    const params: Array<string | number> = [];

    if (input.search) {
      const search = `%${input.search}%`;
      where.push("(p.name LIKE ? OR p.mobile LIKE ? OR u.email LIKE ?)");
      params.push(search, search, search);
    }

    if (input.type === "member") where.push("p.user_id IS NOT NULL AND p.is_guest=0");
    if (input.type === "guest") where.push("(p.user_id IS NULL OR p.is_guest=1)");

    if (input.status === "GUEST") {
      where.push("p.user_id IS NULL");
    } else if (input.status !== "all") {
      where.push("u.status=?");
      params.push(input.status);
    }

    const whereSql = where.join(" AND ");
    const offset = (input.page - 1) * input.pageSize;

    const [countRow] = await queryRows<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM players p
      LEFT JOIN users u ON u.id=p.user_id AND u.deleted_at IS NULL
      WHERE ${whereSql}
    `, params);

    const [overviewRow] = await queryRows<OverviewRow[]>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.user_id IS NOT NULL AND p.is_guest=0 THEN 1 ELSE 0 END) AS members,
        SUM(CASE WHEN p.user_id IS NULL OR p.is_guest=1 THEN 1 ELSE 0 END) AS guests,
        SUM(CASE WHEN u.status='ACTIVE' AND u.deleted_at IS NULL THEN 1 ELSE 0 END) AS active_accounts
      FROM players p
      LEFT JOIN users u ON u.id=p.user_id
    `);

    const rows = await queryRows<PlayerRow[]>(`
      SELECT
        p.id,p.user_id,p.name,p.mobile,p.avatar_url,p.is_guest,p.created_at,p.updated_at,
        u.email,u.status AS account_status,u.mobile_verified,u.email_verified,
        COALESCE(reg.registration_count,0) AS registration_count,
        COALESCE(reg.tournament_count,0) AS tournament_count,
        COALESCE(teams.team_count,0) AS team_count,
        COALESCE(ranking.total_points,0) AS total_points,
        COALESCE(ranking.ranking_played,0) AS ranking_played,
        COALESCE(ranking.ranking_wins,0) AS ranking_wins,
        reg.last_tournament_title,
        reg.last_registration_at
      FROM players p
      LEFT JOIN users u ON u.id=p.user_id AND u.deleted_at IS NULL
      LEFT JOIN (
        SELECT
          participant.player_id,
          COUNT(DISTINCT participant.registration_id) AS registration_count,
          COUNT(DISTINCT r.tournament_id) AS tournament_count,
          MAX(r.created_at) AS last_registration_at,
          SUBSTRING_INDEX(
            GROUP_CONCAT(t.title ORDER BY r.created_at DESC SEPARATOR '|||'),
            '|||',
            1
          ) AS last_tournament_title
        FROM (
          SELECT re.registration_id,re.player_id
          FROM registration_entries re
          WHERE re.player_id IS NOT NULL
          UNION
          SELECT re.registration_id,tm.player_id
          FROM registration_entries re
          INNER JOIN team_members tm ON tm.team_id=re.team_id
          WHERE re.team_id IS NOT NULL
        ) participant
        INNER JOIN registrations r ON r.id=participant.registration_id AND r.deleted_at IS NULL
        INNER JOIN tournaments t ON t.id=r.tournament_id
        GROUP BY participant.player_id
      ) reg ON reg.player_id=p.id
      LEFT JOIN (
        SELECT player_id,COUNT(*) AS team_count
        FROM team_members
        GROUP BY player_id
      ) teams ON teams.player_id=p.id
      LEFT JOIN (
        SELECT
          player_id,
          SUM(points) AS total_points,
          SUM(played) AS ranking_played,
          SUM(wins) AS ranking_wins
        FROM ranking_entries
        GROUP BY player_id
      ) ranking ON ranking.player_id=p.id
      WHERE ${whereSql}
      ORDER BY p.created_at DESC,p.id DESC
      LIMIT ? OFFSET ?
    `, [...params, input.pageSize, offset]);

    const total = Number(countRow?.total || 0);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : null,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        avatarUrl: row.avatar_url,
        isGuest: Boolean(row.is_guest || !row.user_id),
        accountStatus: row.user_id ? row.account_status || "PENDING" : "GUEST",
        mobileVerified: Boolean(row.mobile_verified),
        emailVerified: Boolean(row.email_verified),
        registrationCount: Number(row.registration_count),
        tournamentCount: Number(row.tournament_count),
        teamCount: Number(row.team_count),
        totalPoints: Number(row.total_points),
        rankingPlayed: Number(row.ranking_played),
        rankingWins: Number(row.ranking_wins),
        lastTournamentTitle: row.last_tournament_title,
        lastRegistrationAt: row.last_registration_at ? new Date(row.last_registration_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString()
      })),
      overview: {
        total: Number(overviewRow?.total || 0),
        members: Number(overviewRow?.members || 0),
        guests: Number(overviewRow?.guests || 0),
        activeAccounts: Number(overviewRow?.active_accounts || 0)
      },
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "پارامترهای فیلتر بازیکنان معتبر نیستند." }, { status: 422 });
    }

    console.error("admin players GET failed", error);
    return NextResponse.json({ message: "دریافت فهرست بازیکنان انجام نشد." }, { status: 500 });
  }
}
