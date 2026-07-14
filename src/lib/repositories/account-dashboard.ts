import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";

type AccountStatsRow = RowDataPacket & {
  active_registrations: number;
  ready_qr: number;
  pending_payments: number;
  unread_notifications: number;
};

type NextMatchRow = RowDataPacket & {
  id: number;
  tournament_title: string;
  round_title: string | null;
  resource_title: string | null;
  scheduled_at: Date | null;
  opponent_name: string | null;
};

export type AccountDashboardData = {
  activeRegistrations: number;
  readyQr: number;
  pendingPayments: number;
  unreadNotifications: number;
  nextMatch: null | {
    id: number;
    tournamentTitle: string;
    roundTitle: string;
    resourceTitle: string;
    scheduledAt: string | null;
    opponentName: string;
  };
};

export async function getAccountDashboardData(userId: string | number): Promise<AccountDashboardData> {
  const [statsRows, nextMatchRows] = await Promise.all([
    queryRows<AccountStatsRow[]>(`
      SELECT
        (
          SELECT COUNT(*)
          FROM registrations r
          WHERE r.buyer_user_id=?
            AND r.deleted_at IS NULL
            AND r.status IN ('PENDING_APPROVAL','NEEDS_CORRECTION','CONFIRMED','CHECKED_IN')
        ) AS active_registrations,
        (
          SELECT COUNT(*)
          FROM registrations r
          WHERE r.buyer_user_id=?
            AND r.deleted_at IS NULL
            AND r.status IN ('CONFIRMED','CHECKED_IN')
            AND r.qr_token IS NOT NULL
        ) AS ready_qr,
        (
          SELECT COUNT(*)
          FROM payments p
          JOIN registrations r ON r.id=p.registration_id
          WHERE COALESCE(p.user_id,r.buyer_user_id)=?
            AND p.status IN ('PENDING','NEEDS_CORRECTION')
        ) AS pending_payments,
        (
          SELECT COUNT(*)
          FROM notifications n
          WHERE n.user_id=? AND n.read_at IS NULL
        ) AS unread_notifications
    `, [userId, userId, userId, userId]),
    queryRows<NextMatchRow[]>(`
      SELECT DISTINCT
        m.id,
        t.title AS tournament_title,
        tr.title AS round_title,
        res.title AS resource_title,
        m.scheduled_at,
        CASE
          WHEN own_participant.slot=1 THEN COALESCE(opponent_team.title,opponent_player.name)
          ELSE COALESCE(home_team.title,home_player.name)
        END AS opponent_name
      FROM players own_player
      JOIN match_participants own_participant
        ON own_participant.player_id=own_player.id
        OR own_participant.team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.player_id=own_player.id
        )
      JOIN tournament_matches m ON m.id=own_participant.match_id
      JOIN tournaments t ON t.id=m.tournament_id
      LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
      LEFT JOIN resources res ON res.id=m.resource_id
      LEFT JOIN match_participants opponent
        ON opponent.match_id=m.id AND opponent.slot<>own_participant.slot
      LEFT JOIN teams opponent_team ON opponent_team.id=opponent.team_id
      LEFT JOIN players opponent_player ON opponent_player.id=opponent.player_id
      LEFT JOIN match_participants home_participant
        ON home_participant.match_id=m.id AND home_participant.slot=1
      LEFT JOIN teams home_team ON home_team.id=home_participant.team_id
      LEFT JOIN players home_player ON home_player.id=home_participant.player_id
      WHERE own_player.user_id=?
        AND m.status IN ('PENDING','READY','LIVE')
        AND t.deleted_at IS NULL
      ORDER BY
        FIELD(m.status,'LIVE','READY','PENDING'),
        COALESCE(m.scheduled_at,t.starts_at) ASC,
        m.id ASC
      LIMIT 1
    `, [userId])
  ]);

  const stats = statsRows[0];
  const next = nextMatchRows[0];

  return {
    activeRegistrations: Number(stats?.active_registrations || 0),
    readyQr: Number(stats?.ready_qr || 0),
    pendingPayments: Number(stats?.pending_payments || 0),
    unreadNotifications: Number(stats?.unread_notifications || 0),
    nextMatch: next ? {
      id: Number(next.id),
      tournamentTitle: next.tournament_title,
      roundTitle: next.round_title || "مرحله مسابقه",
      resourceTitle: next.resource_title || "محل بازی اعلام نشده",
      scheduledAt: next.scheduled_at ? new Date(next.scheduled_at).toISOString() : null,
      opponentName: next.opponent_name || "حریف هنوز مشخص نشده"
    } : null
  };
}
