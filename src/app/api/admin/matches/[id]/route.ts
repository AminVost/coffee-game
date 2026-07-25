import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { advanceTournament, recalculateRankingsForTournament } from "@/lib/tournament-engine";

const schema = z.object({
  homeScore: z.coerce.number().int().min(0).max(999),
  awayScore: z.coerce.number().int().min(0).max(999),
  status: z.enum(["READY", "LIVE", "COMPLETED", "POSTPONED"]),
  notes: z.string().trim().max(1000).optional().nullable(),
  resourceId: z.coerce.number().int().positive().optional().nullable(),
  refereeUserId: z.coerce.number().int().positive().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  durationMin: z.coerce.number().int().min(5).max(240).optional().nullable()
});

type MatchRow = RowDataPacket & {
  id: number;
  tournament_id: number;
  round_id: number | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  referee_user_id: number | null;
  resource_id: number | null;
  scheduled_at: Date | null;
  duration_min: number | null;
  format: string;
  game_settings: unknown;
};

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function allowsDraw(format: string, settings: Record<string, unknown>) {
  const normalized = format.toLowerCase();
  return settings.allowDraw === true
    || normalized.includes("رفت‌وبرگشت")
    || normalized.includes("رفت و برگشت")
    || normalized.includes("home and away")
    || normalized.includes("two leg")
    || normalized.includes("لیگ")
    || normalized.includes("group")
    || normalized.includes("گروه")
    || normalized.includes("swiss")
    || normalized.includes("سوئیس");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("results.submit");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ message: "شناسه بازی نامعتبر است." }, { status: 400 });
    const canManageAll = hasPermission(auth.user, "matches.manage");
    const connection = await db.getConnection();
    let match: MatchRow | null = null;
    let winnerSlot: number | null = null;
    let advancement: unknown = null;

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<MatchRow[]>(`
        SELECT m.id,m.tournament_id,m.round_id,m.status,m.home_score,m.away_score,m.referee_user_id,
               m.resource_id,m.scheduled_at,m.duration_min,t.format,t.game_settings
        FROM tournament_matches m
        JOIN tournaments t ON t.id=m.tournament_id
        WHERE m.id=?
        LIMIT 1
        FOR UPDATE
      `, [id]);
      match = rows[0] || null;
      if (!match) {
        await connection.rollback();
        return NextResponse.json({ message: "بازی یافت نشد." }, { status: 404 });
      }
      if (!canManageAll && String(match.referee_user_id || "") !== auth.user.id) {
        await connection.rollback();
        return NextResponse.json({ message: "این بازی به شما تخصیص داده نشده است." }, { status: 403 });
      }
      if (!canManageAll && match.status === "COMPLETED") {
        await connection.rollback();
        return NextResponse.json({ message: "نتیجه نهایی فقط توسط مدیر قابل اصلاح است." }, { status: 409 });
      }

      if (match.status === "COMPLETED") {
        const [laterRows] = await connection.query<RowDataPacket[]>(`
          SELECT next_match.id
          FROM tournament_matches current_match
          JOIN tournament_rounds current_round ON current_round.id=current_match.round_id
          JOIN tournament_matches next_match ON next_match.tournament_id=current_match.tournament_id
          JOIN tournament_rounds next_round ON next_round.id=next_match.round_id
          WHERE current_match.id=? AND next_round.round_number>current_round.round_number
          LIMIT 1
        `, [id]);
        if (laterRows[0]) {
          await connection.rollback();
          return NextResponse.json({ message: "پس از ایجاد دور بعد، نتیجه این بازی قابل تغییر نیست." }, { status: 409 });
        }
      }

      const settings = parseObject(match.game_settings);
      const maxScore = Number.isFinite(Number(settings.maxScore)) ? Math.max(1, Math.min(999, Number(settings.maxScore))) : 999;
      if (input.homeScore > maxScore || input.awayScore > maxScore) {
        await connection.rollback();
        return NextResponse.json({ message: `امتیاز نمی‌تواند بیشتر از ${maxScore.toLocaleString("fa-IR")} باشد.` }, { status: 422 });
      }
      if (input.status === "COMPLETED" && input.homeScore === input.awayScore && !allowsDraw(match.format, settings)) {
        await connection.rollback();
        return NextResponse.json({ message: "این فرمت مسابقه با نتیجه مساوی قابل پایان نیست." }, { status: 422 });
      }

      const scheduledAt = canManageAll
        ? (input.scheduledAt ? new Date(input.scheduledAt) : null)
        : match.scheduled_at;
      const durationMin = canManageAll ? (input.durationMin || 30) : (match.duration_min || 30);
      const resourceId = canManageAll ? (input.resourceId || null) : match.resource_id;
      const refereeUserId = canManageAll ? (input.refereeUserId || null) : match.referee_user_id;

      if (scheduledAt) {
        if (resourceId) {
          const [resourceConflict] = await connection.query<RowDataPacket[]>(`
            SELECT id FROM tournament_matches
            WHERE id<>? AND resource_id=? AND status NOT IN ('CANCELLED','COMPLETED')
              AND scheduled_at IS NOT NULL
              AND scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
              AND DATE_ADD(scheduled_at,INTERVAL COALESCE(duration_min,30) MINUTE) > ?
            LIMIT 1
          `, [id, resourceId, scheduledAt, durationMin, scheduledAt]);
          if (resourceConflict[0]) throw new Error("RESOURCE_CONFLICT");
        }
        if (refereeUserId) {
          const [refereeConflict] = await connection.query<RowDataPacket[]>(`
            SELECT id FROM tournament_matches
            WHERE id<>? AND referee_user_id=? AND status NOT IN ('CANCELLED','COMPLETED')
              AND scheduled_at IS NOT NULL
              AND scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
              AND DATE_ADD(scheduled_at,INTERVAL COALESCE(duration_min,30) MINUTE) > ?
            LIMIT 1
          `, [id, refereeUserId, scheduledAt, durationMin, scheduledAt]);
          if (refereeConflict[0]) throw new Error("REFEREE_CONFLICT");
        }
        const [participantConflict] = await connection.query<RowDataPacket[]>(`
          SELECT other.id
          FROM match_participants current_participant
          JOIN match_participants other_participant
            ON (other_participant.player_id<=>current_participant.player_id)
           AND (other_participant.team_id<=>current_participant.team_id)
          JOIN tournament_matches other ON other.id=other_participant.match_id
          WHERE current_participant.match_id=? AND other.id<>?
            AND other.status NOT IN ('CANCELLED','COMPLETED')
            AND other.scheduled_at IS NOT NULL
            AND other.scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
            AND DATE_ADD(other.scheduled_at,INTERVAL COALESCE(other.duration_min,30) MINUTE) > ?
          LIMIT 1
        `, [id, id, scheduledAt, durationMin, scheduledAt]);
        if (participantConflict[0]) throw new Error("PARTICIPANT_CONFLICT");
      }

      winnerSlot = input.status === "COMPLETED" && input.homeScore !== input.awayScore
        ? (input.homeScore > input.awayScore ? 1 : 2)
        : null;

      await connection.execute(`
        UPDATE tournament_matches
        SET home_score=?,away_score=?,status=?,winner_slot=?,notes=?,resource_id=?,referee_user_id=?,scheduled_at=?,duration_min=?,
            started_at=IF(?='LIVE' AND started_at IS NULL,NOW(),started_at),
            completed_at=IF(?='COMPLETED',NOW(),NULL)
        WHERE id=?
      `, [
        input.homeScore, input.awayScore, input.status, winnerSlot, input.notes || null,
        resourceId, refereeUserId, scheduledAt, durationMin,
        input.status, input.status, id
      ]);
      await connection.execute(`UPDATE match_participants SET is_winner=0 WHERE match_id=?`, [id]);
      if (winnerSlot) await connection.execute(`UPDATE match_participants SET is_winner=1 WHERE match_id=? AND slot=?`, [id, winnerSlot]);
      if (input.status === "LIVE") await connection.execute(`UPDATE tournaments SET status='RUNNING' WHERE id=? AND status<>'COMPLETED'`, [match.tournament_id]);
      if (input.status === "COMPLETED") {
        advancement = await advanceTournament(connection, match.tournament_id);
        await recalculateRankingsForTournament(connection, match.tournament_id);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "match.updated",
      entityType: "tournament_match",
      entityId: id,
      oldData: match ? { status: match.status, homeScore: match.home_score, awayScore: match.away_score } : undefined,
      newData: input,
      request
    });
    return NextResponse.json({ ok: true, winnerSlot, advancement });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "اطلاعات بازی نامعتبر است.", errors: error.issues }, { status: 422 });
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      RESOURCE_CONFLICT: "منبع انتخاب‌شده در این بازه زمانی مشغول است.",
      REFEREE_CONFLICT: "داور انتخاب‌شده در این بازه بازی دیگری دارد.",
      PARTICIPANT_CONFLICT: "یکی از شرکت‌کنندگان در این بازه بازی دیگری دارد.",
      AGGREGATE_TIE: "مجموع نتیجه رفت‌وبرگشت مساوی است و باید نتیجه تعیین‌کننده ثبت شود."
    };
    return NextResponse.json({ message: messages[code] || "ذخیره بازی انجام نشد." }, { status: messages[code] ? 409 : 500 });
  }
}
