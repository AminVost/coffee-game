import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import { tournamentInputSchema } from "@/lib/tournament-input";

type TournamentRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  status: string;
  capacity: number;
  game_id: number;
  participant_type: string;
  team_size: number;
  format: string;
  template_id: number | null;
};

type CountRow = RowDataPacket & {
  registration_count: number;
  match_count: number;
  hold_count: number;
  waitlist_count: number;
  occupied: number;
};

async function getTournamentCounts(
  connection: import("mysql2/promise").PoolConnection,
  tournamentId: string
) {
  const [rows] = await connection.query<CountRow[]>(`
    SELECT
      (SELECT COUNT(*) FROM registrations WHERE tournament_id=? AND deleted_at IS NULL) AS registration_count,
      (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id=?) AS match_count,
      (SELECT COUNT(*) FROM registration_holds WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()) AS hold_count,
      (SELECT COUNT(*) FROM waitlist_entries WHERE tournament_id=? AND status IN ('WAITING','OFFERED')) AS waitlist_count,
      (
        SELECT COALESCE(SUM(
          CASE
            WHEN status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN slots
            WHEN status='PENDING_PAYMENT' AND (reserved_until IS NULL OR reserved_until>NOW()) THEN slots
            WHEN status='NEEDS_CORRECTION' AND correction_expires_at>NOW() THEN slots
            ELSE 0
          END
        ),0)
        FROM registrations
        WHERE tournament_id=? AND deleted_at IS NULL
      )
      +
      (
        SELECT COALESCE(SUM(slots),0)
        FROM registration_holds
        WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
      )
      +
      (
        SELECT COALESCE(SUM(slots),0)
        FROM waitlist_entries
        WHERE tournament_id=? AND status='OFFERED' AND offer_expires_at>NOW()
      ) AS occupied
  `, [
    tournamentId,
    tournamentId,
    tournamentId,
    tournamentId,
    tournamentId,
    tournamentId,
    tournamentId
  ]);
  return rows[0];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  const { id } = await params;
  const rows = await queryRows<RowDataPacket[]>(`
    SELECT * FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1
  `, [id]);
  if (!rows[0]) {
    return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
  }
  return NextResponse.json({ item: rows[0] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const input = tournamentInputSchema.parse(await request.json());
    const { id } = await params;
    const connection = await db.getConnection();
    let old: TournamentRow | null = null;

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<TournamentRow[]>(`
        SELECT id,slug,title,status,capacity,game_id,participant_type,team_size,format,template_id
        FROM tournaments
        WHERE id=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [id]);
      old = rows[0] || null;

      if (!old) {
        await connection.rollback();
        return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
      }

      const counts = await getTournamentCounts(connection, id);
      const structuralChanged = Number(old.game_id) !== input.gameId
        || old.participant_type !== input.participantType
        || Number(old.team_size) !== input.teamSize
        || old.format !== input.format;

      if (
        structuralChanged
        && (
          Number(counts.registration_count) > 0
          || Number(counts.match_count) > 0
          || Number(counts.hold_count) > 0
          || Number(counts.waitlist_count) > 0
        )
      ) {
        await connection.rollback();
        return NextResponse.json({
          message: "پس از ایجاد ثبت‌نام، رزرو، صف انتظار یا بازی، ساختار مسابقه قابل تغییر نیست."
        }, { status: 409 });
      }

      if (input.capacity < Number(counts.occupied)) {
        await connection.rollback();
        return NextResponse.json({
          message: `ظرفیت نمی‌تواند کمتر از ظرفیت اشغال‌شده (${Number(counts.occupied).toLocaleString("fa-IR")}) باشد.`
        }, { status: 409 });
      }

      if (input.status === "DRAFT" && (
        Number(counts.registration_count) > 0
        || Number(counts.hold_count) > 0
        || Number(counts.waitlist_count) > 0
      )) {
        await connection.rollback();
        return NextResponse.json({
          message: "مسابقه دارای ثبت‌نام، رزرو یا صف انتظار را نمی‌توان به پیش‌نویس بازگرداند."
        }, { status: 409 });
      }

      if (input.templateId) {
        const [templates] = await connection.query<RowDataPacket[]>(`
          SELECT id
          FROM tournament_templates
          WHERE id=? AND is_active=1
          LIMIT 1
        `, [input.templateId]);
        if (!templates[0]) {
          await connection.rollback();
          return NextResponse.json({ message: "قالب انتخاب‌شده فعال نیست." }, { status: 422 });
        }
      }

      await connection.execute(`
        UPDATE tournaments SET
          slug=?,title=?,subtitle=?,description=?,game_id=?,template_id=?,venue_id=?,
          format=?,participant_type=?,team_size=?,capacity=?,min_participants=?,price=?,status=?,
          registration_starts_at=?,registration_ends_at=?,starts_at=?,ends_at=?,
          reservation_expires_min=?,late_tolerance_min=?,waitlist_mode=?,allow_multi_slot=?,
          has_third_place=?,draw_mode=?,rules=?,game_settings=?,scoring_settings=?,
          notification_settings=?,cancellation_settings=?,prize_settings=?,cover_image_url=?,
          is_featured=?,
          published_at=IF(? IN ('PUBLISHED','REGISTRATION_OPEN') AND published_at IS NULL,NOW(),published_at),
          updated_at=NOW()
        WHERE id=?
      `, [
        input.slug,
        input.title,
        input.subtitle || null,
        input.description || null,
        input.gameId,
        input.templateId || null,
        input.venueId || null,
        input.format,
        input.participantType,
        input.teamSize,
        input.capacity,
        input.minParticipants,
        input.price,
        input.status,
        input.registrationStartsAt ? new Date(input.registrationStartsAt) : null,
        input.registrationEndsAt ? new Date(input.registrationEndsAt) : null,
        new Date(input.startsAt),
        input.endsAt ? new Date(input.endsAt) : null,
        input.reservationExpiresMin,
        input.lateToleranceMin,
        input.waitlistMode,
        input.allowMultiSlot ? 1 : 0,
        input.hasThirdPlace ? 1 : 0,
        input.drawMode,
        JSON.stringify(input.rules),
        JSON.stringify(input.gameSettings),
        JSON.stringify(input.scoringSettings),
        JSON.stringify(input.notificationSettings),
        JSON.stringify(input.cancellationSettings),
        JSON.stringify(input.prizeSettings),
        input.coverImageUrl || null,
        input.isFeatured ? 1 : 0,
        input.status,
        id
      ]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.updated",
      entityType: "tournament",
      entityId: id,
      oldData: old,
      newData: input,
      request
    });
    return NextResponse.json({ ok: true, slug: input.slug });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات ویرایش نامعتبر است.",
        errors: error.issues
      }, { status: 422 });
    }
    if (error instanceof Error && /Duplicate entry/.test(error.message)) {
      return NextResponse.json({ message: "این آدرس مسابقه قبلاً استفاده شده است." }, { status: 409 });
    }
    console.error("tournament.update.failed", error);
    return NextResponse.json({ message: "ویرایش مسابقه انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  const { id } = await params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT id FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1 FOR UPDATE
    `, [id]);
    if (!rows[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
    }

    const counts = await getTournamentCounts(connection, id);
    if (
      Number(counts.registration_count) > 0
      || Number(counts.match_count) > 0
      || Number(counts.hold_count) > 0
      || Number(counts.waitlist_count) > 0
    ) {
      await connection.rollback();
      return NextResponse.json({
        message: "مسابقه دارای ثبت‌نام، رزرو، صف انتظار یا بازی قابل حذف نیست؛ وضعیت آن را لغوشده کنید."
      }, { status: 409 });
    }

    await connection.execute(`
      UPDATE tournaments SET deleted_at=NOW(),updated_at=NOW() WHERE id=?
    `, [id]);
    await connection.commit();

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.deleted",
      entityType: "tournament",
      entityId: id,
      request
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("tournament.delete.failed", error);
    return NextResponse.json({ message: "حذف مسابقه انجام نشد." }, { status: 500 });
  } finally {
    connection.release();
  }
}
