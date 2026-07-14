import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  acquirePlayerMobileLocks,
  releasePlayerMobileLocks
} from "@/lib/player-identity";
import {
  createHoldToken,
  expireStaleRegistrationState
} from "@/lib/registration-flow";
import { getRequestIp, getRequestUserAgent } from "@/lib/request-context";

const playerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^09\d{9}$/)
});

const schema = z.object({
  tournamentId: z.string().regex(/^\d+$/),
  players: z.array(playerSchema).min(1).max(20),
  teamTitle: z.string().trim().min(2).max(140).optional()
});

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  capacity: number;
  price: number;
  allow_multi_slot: number;
  participant_type: "INDIVIDUAL" | "TEAM";
  team_size: number;
  status: string;
};

type ExistingHoldRow = RowDataPacket & {
  id: number;
  public_id: string;
  hold_token: string;
};

type CountRow = RowDataPacket & {
  occupied_slots: number;
};

type DuplicateRow = RowDataPacket & {
  mobile: string;
};

type RateRow = RowDataPacket & {
  hourly_count: number;
};

function normalizePlayers(players: z.infer<typeof playerSchema>[]) {
  return players.map((player) => ({
    name: player.name.trim(),
    mobile: player.mobile.trim()
  }));
}

function validatePlayerCount(tournament: TournamentRow, playersLength: number) {
  if (tournament.participant_type === "TEAM") {
    if (playersLength !== tournament.team_size) {
      return {
        error: `برای ثبت این تیم باید دقیقاً ${tournament.team_size.toLocaleString("fa-IR")} بازیکن وارد شود.`,
        slots: 0
      };
    }
    return { error: null, slots: 1 };
  }

  if (playersLength > 1 && !tournament.allow_multi_slot) {
    return { error: "ثبت چند شرکت‌کننده برای این مسابقه فعال نیست.", slots: 0 };
  }

  return { error: null, slots: playersLength };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getSession();

    if (!user || !/^\d+$/.test(user.id) || !user.mobile) {
      return NextResponse.json({
        message: "برای رزرو ظرفیت ابتدا شماره موبایل خود را تایید کنید.",
        requiresOtp: true
      }, { status: 401 });
    }

    const players = normalizePlayers(input.players);
    const mobiles = players.map((player) => player.mobile);
    if (new Set(mobiles).size !== mobiles.length) {
      return NextResponse.json({
        message: "هر شماره موبایل را فقط یک‌بار وارد کنید."
      }, { status: 409 });
    }

    const connection = await db.getConnection();
    let mobileLocks: string[] = [];

    try {
      mobileLocks = await acquirePlayerMobileLocks(connection, mobiles);
      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      const [tournaments] = await connection.query<TournamentRow[]>(`
        SELECT id,title,capacity,price,allow_multi_slot,participant_type,team_size,status
        FROM tournaments
        WHERE id=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [input.tournamentId]);

      const tournament = tournaments[0];
      if (!tournament) {
        await connection.rollback();
        return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
      }

      if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(tournament.status)) {
        await connection.rollback();
        return NextResponse.json({ message: "ثبت‌نام این مسابقه فعال نیست." }, { status: 409 });
      }

      const countValidation = validatePlayerCount(tournament, players.length);
      if (countValidation.error) {
        await connection.rollback();
        return NextResponse.json({ message: countValidation.error }, { status: 422 });
      }

      const requestedSlots = countValidation.slots;
      const userId = Number(user.id);
      const requestIp = getRequestIp(request);
      const userAgent = getRequestUserAgent(request);

      const [existingRows] = await connection.query<ExistingHoldRow[]>(`
        SELECT id,public_id,hold_token
        FROM registration_holds
        WHERE tournament_id=?
          AND user_id=?
          AND status='ACTIVE'
          AND expires_at>NOW()
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `, [tournament.id, userId]);
      const existingHold = existingRows[0] || null;

      if (!existingHold && requestIp) {
        const [rateRows] = await connection.query<RateRow[]>(`
          SELECT COUNT(*) AS hourly_count
          FROM registration_holds
          WHERE request_ip=?
            AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)
        `, [requestIp]);

        if (Number(rateRows[0]?.hourly_count || 0) >= 8) {
          await connection.rollback();
          return NextResponse.json({
            message: "تعداد درخواست‌های رزرو از این دستگاه بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
          }, { status: 429 });
        }
      }

      for (const mobile of mobiles) {
        const [duplicateRows] = await connection.query<DuplicateRow[]>(`
          SELECT ? AS mobile
          WHERE EXISTS (
            SELECT 1
            FROM registrations r
            JOIN registration_entries re ON re.registration_id=r.id
            LEFT JOIN players p ON p.id=re.player_id
            LEFT JOIN team_members tm ON tm.team_id=re.team_id
            LEFT JOIN players tp ON tp.id=tm.player_id
            WHERE r.tournament_id=?
              AND r.deleted_at IS NULL
              AND (
                r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN')
                OR (r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()))
                OR (r.status='NEEDS_CORRECTION' AND r.correction_expires_at>NOW())
              )
              AND (p.mobile=? OR tp.mobile=?)
          )
          OR EXISTS (
            SELECT 1
            FROM registration_holds rh
            WHERE rh.tournament_id=?
              AND rh.status='ACTIVE'
              AND rh.expires_at>NOW()
              AND rh.id<>?
              AND JSON_SEARCH(rh.player_data,'one',?,NULL,'$[*].mobile') IS NOT NULL
          )
          LIMIT 1
        `, [
          mobile,
          tournament.id,
          mobile,
          mobile,
          tournament.id,
          existingHold?.id || 0,
          mobile
        ]);

        if (duplicateRows.length) {
          await connection.rollback();
          return NextResponse.json({
            message: `شماره ${mobile} قبلاً برای این مسابقه ثبت یا رزرو شده است.`
          }, { status: 409 });
        }
      }

      const [countRows] = await connection.query<CountRow[]>(`
        SELECT
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
            WHERE tournament_id=?
              AND status='ACTIVE'
              AND expires_at>NOW()
              AND id<>?
          ) AS occupied_slots
      `, [tournament.id, tournament.id, existingHold?.id || 0]);

      const occupiedSlots = Number(countRows[0]?.occupied_slots || 0);
      if (occupiedSlots + requestedSlots > Number(tournament.capacity)) {
        await connection.rollback();
        return NextResponse.json({
          message: "ظرفیت مسابقه تکمیل شده است."
        }, { status: 409 });
      }

      const expiresAt = new Date(Date.now() + env.registrationHoldMinutes * 60_000);
      const amount = Number(tournament.price) * requestedSlots;
      const playerJson = JSON.stringify(players);
      let holdToken: string;
      let resumed = false;

      if (existingHold) {
        holdToken = existingHold.hold_token;
        resumed = true;
        await connection.execute(`
          UPDATE registration_holds
          SET
            contact_mobile=?,
            player_data=?,
            team_title=?,
            participant_type=?,
            slots=?,
            amount=?,
            expires_at=?,
            request_ip=?,
            user_agent=?,
            updated_at=NOW()
          WHERE id=?
        `, [
          user.mobile,
          playerJson,
          input.teamTitle || null,
          tournament.participant_type,
          requestedSlots,
          amount,
          expiresAt,
          requestIp,
          userAgent,
          existingHold.id
        ]);
      } else {
        holdToken = createHoldToken();
        await connection.execute<ResultSetHeader>(`
          INSERT INTO registration_holds(
            public_id,hold_token,tournament_id,user_id,contact_mobile,
            player_data,team_title,participant_type,slots,amount,status,
            expires_at,request_ip,user_agent,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?,NOW(),NOW())
        `, [
          randomUUID(),
          holdToken,
          tournament.id,
          userId,
          user.mobile,
          playerJson,
          input.teamTitle || null,
          tournament.participant_type,
          requestedSlots,
          amount,
          expiresAt,
          requestIp,
          userAgent
        ]);
      }

      const firstPlayerName = players[0]?.name;
      if (firstPlayerName) {
        await connection.execute(`
          UPDATE users
          SET name=?,updated_at=NOW()
          WHERE id=? AND (name LIKE 'کاربر %' OR name='کاربر پیامکی')
        `, [firstPlayerName, userId]);
      }

      await connection.commit();

      return NextResponse.json({
        ok: true,
        holdToken,
        expiresAt: expiresAt.toISOString(),
        holdMinutes: env.registrationHoldMinutes,
        amount,
        contactMobile: user.mobile,
        resumed
      }, { status: existingHold ? 200 : 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, mobileLocks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات اولیه ثبت‌نام نامعتبر است.",
        errors: error.issues
      }, { status: 422 });
    }

    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({
        message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید."
      }, { status: 409 });
    }

    console.error("registration.hold.create.failed", error);
    return NextResponse.json({ message: "رزرو موقت ظرفیت انجام نشد." }, { status: 500 });
  }
}
