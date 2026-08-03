import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { listTournaments } from "@/lib/repositories/tournaments";
import { openRegistrationStatusError } from "@/lib/tournament-definition";
import { tournamentInputSchema } from "@/lib/tournament-input";

export async function GET() {
  return NextResponse.json({ items: await listTournaments(false) });
}

export async function POST(request: Request) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const input = tournamentInputSchema.parse(await request.json());

    if (!["DRAFT", "PUBLISHED", "REGISTRATION_OPEN"].includes(input.status)) {
      return NextResponse.json({
        message: "مسابقه جدید فقط می‌تواند پیش‌نویس، منتشرشده یا دارای ثبت‌نام باز باشد."
      }, { status: 422 });
    }

    if (new Date(input.startsAt).getTime() <= Date.now()) {
      return NextResponse.json({
        message: "زمان شروع مسابقه جدید باید در آینده باشد."
      }, { status: 422 });
    }

    if (input.status === "REGISTRATION_OPEN") {
      const statusError = openRegistrationStatusError(input);
      if (statusError) {
        return NextResponse.json({ message: statusError }, { status: 422 });
      }
    }

    const connection = await db.getConnection();
    let id = 0;

    try {
      await connection.beginTransaction();

      const [games] = await connection.query<RowDataPacket[]>(`
        SELECT id FROM games WHERE id=? AND is_active=1 LIMIT 1
      `, [input.gameId]);
      if (!games[0]) {
        await connection.rollback();
        return NextResponse.json({ message: "بازی انتخاب‌شده فعال نیست." }, { status: 422 });
      }

      if (input.venueId) {
        const [venues] = await connection.query<RowDataPacket[]>(`
          SELECT id FROM venues WHERE id=? AND is_active=1 LIMIT 1
        `, [input.venueId]);
        if (!venues[0]) {
          await connection.rollback();
          return NextResponse.json({ message: "محل انتخاب‌شده فعال نیست." }, { status: 422 });
        }
      }

      if (input.templateId) {
        const [templates] = await connection.query<RowDataPacket[]>(`
          SELECT id
          FROM tournament_templates
          WHERE id=? AND is_active=1
          LIMIT 1
          FOR UPDATE
        `, [input.templateId]);
        if (!templates[0]) {
          await connection.rollback();
          return NextResponse.json({ message: "قالب انتخاب‌شده فعال نیست." }, { status: 422 });
        }
      }

      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO tournaments(
          public_id,slug,title,subtitle,description,game_id,template_id,venue_id,
          format,participant_type,team_size,capacity,min_participants,price,currency,status,
          registration_starts_at,registration_ends_at,starts_at,ends_at,
          reservation_expires_min,late_tolerance_min,waitlist_mode,allow_multi_slot,
          has_third_place,draw_mode,rules,game_settings,scoring_settings,
          notification_settings,cancellation_settings,prize_settings,cover_image_url,
          is_featured,published_at,created_at,updated_at
        ) VALUES(
          UUID(),?,?,?,?,?,?,?,?,?,?,?,?,?,'TOMAN',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
          IF(? IN ('PUBLISHED','REGISTRATION_OPEN'),NOW(),NULL),NOW(),NOW()
        )
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
        input.status
      ]);

      id = result.insertId;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.created",
      entityType: "tournament",
      entityId: id,
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, id: String(id), slug: input.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "داده مسابقه نامعتبر است.",
        errors: error.issues
      }, { status: 422 });
    }
    if (error instanceof Error && /uq_tournaments_slug|Duplicate entry/.test(error.message)) {
      return NextResponse.json({ message: "این آدرس مسابقه قبلاً استفاده شده است." }, { status: 409 });
    }
    console.error("tournament.create.failed", error);
    return NextResponse.json({ message: "ثبت مسابقه انجام نشد." }, { status: 500 });
  }
}
