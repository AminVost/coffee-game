import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  acquirePlayerMobileLocks,
  findOrCreateGuestPlayer,
  releasePlayerMobileLocks
} from "@/lib/player-identity";
import {
  createTrackingCode,
  createTrackingToken,
  expireStaleRegistrationState,
  parsePlayerData
} from "@/lib/registration-flow";
import { sendRegistrationTrackingSms } from "@/lib/sms";
import { assertPaymentMethodEnabled } from "@/lib/runtime-settings";

const paymentDetailsSchema = z.object({
  payerName: z.string().trim().min(2).max(120),
  cardLast4: z.string().regex(/^\d{4}$/),
  trackingCode: z.string().trim().min(4).max(64),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()
});

const schema = z.object({
  holdToken: z.string().regex(/^[a-f0-9]{64}$/i),
  payment: z.enum(["card_to_card", "pos", "cash"]),
  paymentDetails: paymentDetailsSchema.optional()
}).superRefine((value, context) => {
  if (value.payment === "card_to_card" && !value.paymentDetails) {
    context.addIssue({
      code: "custom",
      path: ["paymentDetails"],
      message: "اطلاعات انتقال بانکی الزامی است."
    });
  }
});

type HoldRow = RowDataPacket & {
  id: number;
  tournament_id: number;
  user_id: number;
  contact_mobile: string;
  player_data: unknown;
  team_title: string | null;
  existing_team_id: number | null;
  participant_type: "INDIVIDUAL" | "TEAM";
  slots: number;
  amount: number;
  status: string;
  expires_at: Date;
};

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  capacity: number;
  reservation_expires_min: number;
  status: string;
  starts_at: Date;
};

type CountRow = RowDataPacket & {
  occupied_slots: number;
};

type DuplicatePaymentRow = RowDataPacket & {
  id: number;
};

type OwnedTeamRow = RowDataPacket & { id: number; title: string };
type OwnedTeamMemberRow = RowDataPacket & {
  player_id: number;
  name: string;
  mobile: string | null;
};

async function loadOwnedTeamForRegistration(
  connection: import("mysql2/promise").PoolConnection,
  teamId: number,
  userId: number
) {
  const [teams] = await connection.query<OwnedTeamRow[]>(`
    SELECT t.id,t.title
    FROM teams t
    JOIN team_members captain ON captain.team_id=t.id AND captain.is_captain=1
    JOIN players captain_player ON captain_player.id=captain.player_id
    WHERE t.id=? AND captain_player.user_id=?
    LIMIT 1
    FOR UPDATE
  `, [teamId, userId]);
  if (!teams[0]) return null;

  const [members] = await connection.query<OwnedTeamMemberRow[]>(`
    SELECT tm.player_id,p.name,p.mobile
    FROM team_members tm
    JOIN players p ON p.id=tm.player_id
    WHERE tm.team_id=?
    ORDER BY tm.is_captain DESC,tm.joined_at,tm.player_id
    FOR UPDATE
  `, [teamId]);

  if (members.some((member) => !member.mobile || !/^09\d{9}$/.test(member.mobile))) {
    throw new Error("TEAM_MEMBER_MOBILE_REQUIRED");
  }

  return { team: teams[0], members };
}

function isReasonablePaymentDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - 30);
  const newest = new Date(now);
  newest.setDate(newest.getDate() + 1);
  return date >= oldest && date <= newest;
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await assertPaymentMethodEnabled(input.payment);
    const user = await getSession();

    if (!user || !/^\d+$/.test(user.id) || !user.mobile) {
      return NextResponse.json({
        message: "برای تکمیل ثبت‌نام ابتدا شماره موبایل خود را تایید کنید."
      }, { status: 401 });
    }

    const paymentDetails = input.paymentDetails ? {
      payerName: input.paymentDetails.payerName.trim(),
      cardLast4: input.paymentDetails.cardLast4,
      trackingCode: input.paymentDetails.trackingCode.trim(),
      paidOn: input.paymentDetails.paidOn,
      paidTime: input.paymentDetails.paidTime || null
    } : null;

    if (paymentDetails && !isReasonablePaymentDate(paymentDetails.paidOn)) {
      return NextResponse.json({ message: "تاریخ واریز نامعتبر است." }, { status: 422 });
    }

    const userId = Number(user.id);
    const connection = await db.getConnection();
    let playerLocks: string[] = [];

    try {
      const [preliminaryRows] = await connection.query<HoldRow[]>(`
        SELECT id,tournament_id,user_id,contact_mobile,player_data,team_title,
               existing_team_id,participant_type,slots,amount,status,expires_at
        FROM registration_holds
        WHERE hold_token=? AND user_id=?
        LIMIT 1
      `, [input.holdToken, userId]);

      const preliminaryHold = preliminaryRows[0];
      if (!preliminaryHold) {
        return NextResponse.json({ message: "رزرو موقت یافت نشد." }, { status: 404 });
      }

      const preliminaryPlayers = parsePlayerData(preliminaryHold.player_data);
      if (!preliminaryPlayers.length) {
        return NextResponse.json({ message: "اطلاعات شرکت‌کنندگان رزرو موقت نامعتبر است." }, { status: 409 });
      }

      playerLocks = await acquirePlayerMobileLocks(
        connection,
        preliminaryPlayers.map((player) => player.mobile)
      );

      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      const [holdRows] = await connection.query<HoldRow[]>(`
        SELECT id,tournament_id,user_id,contact_mobile,player_data,team_title,
               existing_team_id,participant_type,slots,amount,status,expires_at
        FROM registration_holds
        WHERE hold_token=? AND user_id=?
        LIMIT 1
        FOR UPDATE
      `, [input.holdToken, userId]);
      const hold = holdRows[0];

      if (!hold) {
        await connection.rollback();
        return NextResponse.json({ message: "رزرو موقت یافت نشد." }, { status: 404 });
      }

      if (hold.status !== "ACTIVE" || new Date(hold.expires_at).getTime() <= Date.now()) {
        if (hold.status === "ACTIVE") {
          await connection.execute(`
            UPDATE registration_holds SET status='EXPIRED',updated_at=NOW() WHERE id=?
          `, [hold.id]);
          await connection.commit();
        } else {
          await connection.rollback();
        }

        return NextResponse.json({
          message: "مهلت رزرو موقت ظرفیت به پایان رسیده است. دوباره ظرفیت را رزرو کنید.",
          expired: true
        }, { status: 410 });
      }

      const currentPlayers = parsePlayerData(hold.player_data);
      const preliminaryMobiles = preliminaryPlayers.map((player) => player.mobile);
      const currentMobiles = currentPlayers.map((player) => player.mobile);
      if (JSON.stringify(currentMobiles) !== JSON.stringify(preliminaryMobiles)) {
        await connection.rollback();
        return NextResponse.json({
          message: "اطلاعات شرکت‌کنندگان رزرو موقت تغییر کرده است؛ دوباره ظرفیت را رزرو کنید."
        }, { status: 409 });
      }

      const [tournamentRows] = await connection.query<TournamentRow[]>(`
        SELECT id,title,capacity,reservation_expires_min,status,starts_at
        FROM tournaments
        WHERE id=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [hold.tournament_id]);
      const tournament = tournamentRows[0];

      if (!tournament) {
        await connection.rollback();
        return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
      }

      if (
        tournament.status !== "REGISTRATION_OPEN"
        || new Date(tournament.starts_at).getTime() <= Date.now()
      ) {
        await connection.rollback();
        return NextResponse.json({ message: "ثبت‌نام این مسابقه فعال نیست." }, { status: 409 });
      }

      const players = currentPlayers;
      if (!players.length) {
        await connection.rollback();
        return NextResponse.json({ message: "اطلاعات شرکت‌کنندگان نامعتبر است." }, { status: 409 });
      }

      for (const player of players) {
        const [duplicatePlayers] = await connection.query<RowDataPacket[]>(`
          SELECT r.id
          FROM registrations r
          JOIN registration_entries re ON re.registration_id=r.id
          LEFT JOIN players p ON p.id=re.player_id
          LEFT JOIN team_members tm ON tm.team_id=re.team_id
          LEFT JOIN players tp ON tp.id=tm.player_id
          WHERE r.tournament_id=?
            AND r.deleted_at IS NULL
            AND r.status NOT IN ('CANCELLED','REJECTED','EXPIRED','NO_SHOW')
            AND (p.mobile=? OR tp.mobile=?)
          LIMIT 1
        `, [hold.tournament_id, player.mobile, player.mobile]);

        if (duplicatePlayers.length) {
          await connection.rollback();
          return NextResponse.json({
            message: `شماره ${player.mobile} قبلاً در این مسابقه ثبت شده است.`
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
          )
          +
          (
            SELECT COALESCE(SUM(slots),0)
            FROM waitlist_entries
            WHERE tournament_id=? AND status='OFFERED' AND offer_expires_at>NOW()
          ) AS occupied_slots
      `, [hold.tournament_id, hold.tournament_id, hold.id, hold.tournament_id]);

      if (Number(countRows[0]?.occupied_slots || 0) + Number(hold.slots) > Number(tournament.capacity)) {
        await connection.rollback();
        return NextResponse.json({
          message: "ظرفیت مسابقه در این فاصله تغییر کرده است. دوباره تلاش کنید."
        }, { status: 409 });
      }

      if (paymentDetails) {
        const [duplicatePayments] = await connection.query<DuplicatePaymentRow[]>(`
          SELECT id
          FROM payments
          WHERE method='card_to_card'
            AND tracking_code=?
            AND payer_card_last4=?
            AND amount=?
            AND status NOT IN ('REJECTED','CANCELLED','EXPIRED')
          LIMIT 1
          FOR UPDATE
        `, [
          paymentDetails.trackingCode,
          paymentDetails.cardLast4,
          Number(hold.amount)
        ]);

        if (duplicatePayments.length) {
          await connection.rollback();
          return NextResponse.json({
            message: "این کد پیگیری با همین کارت و مبلغ قبلاً ثبت شده است."
          }, { status: 409 });
        }
      }

      const registrationPublicId = randomUUID();
      const qrToken = randomUUID();
      const trackingCode = createTrackingCode();
      const trackingToken = createTrackingToken();
      const registrationStatus = input.payment === "card_to_card"
        ? "PENDING_APPROVAL"
        : "PENDING_PAYMENT";

      const [registrationResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO registrations(
          public_id,tournament_id,buyer_user_id,contact_mobile,status,slots,
          subtotal,discount_amount,payable_amount,qr_token,tracking_code,
          tracking_token,reserved_until,correction_expires_at,source_hold_id,
          created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,NOW(),NOW())
      `, [
        registrationPublicId,
        hold.tournament_id,
        userId,
        hold.contact_mobile,
        registrationStatus,
        Number(hold.slots),
        Number(hold.amount),
        Number(hold.amount),
        qrToken,
        trackingCode,
        trackingToken,
        input.payment === "card_to_card"
          ? null
          : new Date(Date.now() + tournament.reservation_expires_min * 60_000),
        null,
        hold.id
      ]);

      if (hold.participant_type === "TEAM") {
        let teamId = hold.existing_team_id ? Number(hold.existing_team_id) : 0;

        if (teamId) {
          const ownedTeam = await loadOwnedTeamForRegistration(connection, teamId, userId);
          if (!ownedTeam) {
            await connection.rollback();
            return NextResponse.json({ message: "دیگر اجازه ثبت‌نام این تیم را ندارید." }, { status: 409 });
          }

          const currentMobiles = ownedTeam.members.map((member) => member.mobile!);
          if (JSON.stringify(currentMobiles) !== JSON.stringify(players.map((player) => player.mobile))) {
            await connection.rollback();
            return NextResponse.json({
              message: "ترکیب تیم پس از رزرو ظرفیت تغییر کرده است. دوباره ظرفیت را رزرو کنید."
            }, { status: 409 });
          }
        } else {
          const playerIds: number[] = [];
          for (const player of players) {
            playerIds.push(await findOrCreateGuestPlayer(connection, player));
          }

          const [teamResult] = await connection.execute<ResultSetHeader>(`
            INSERT INTO teams(public_id,title,created_by_id,created_at,updated_at)
            VALUES(?,?,?,NOW(),NOW())
          `, [
            randomUUID(),
            hold.team_title || `تیم ${players[0].name}`,
            userId
          ]);
          teamId = teamResult.insertId;

          for (let index = 0; index < playerIds.length; index += 1) {
            await connection.execute(`
              INSERT INTO team_members(team_id,player_id,is_captain,joined_at)
              VALUES(?,?,?,NOW())
            `, [teamId, playerIds[index], index === 0 ? 1 : 0]);
          }
        }

        await connection.execute(`
          INSERT INTO registration_entries(registration_id,team_id,confirmed_at)
          VALUES(?,?,NULL)
        `, [registrationResult.insertId, teamId]);
      } else {
        for (const player of players) {
          const playerId = await findOrCreateGuestPlayer(connection, player);
          await connection.execute(`
            INSERT INTO registration_entries(registration_id,player_id,confirmed_at)
            VALUES(?,?,NULL)
          `, [registrationResult.insertId, playerId]);
        }
      }

      const paymentPublicId = randomUUID();
      const [paymentResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO payments(
          public_id,user_id,registration_id,method,provider,amount,status,
          payer_name,payer_card_last4,tracking_code,paid_on,paid_time,
          submitted_at,correction_expires_at,created_at,updated_at
        ) VALUES(?,?,?,?,?,?, 'PENDING',?,?,?,?,?,?,NULL,NOW(),NOW())
      `, [
        paymentPublicId,
        userId,
        registrationResult.insertId,
        input.payment,
        null,
        Number(hold.amount),
        paymentDetails?.payerName || null,
        paymentDetails?.cardLast4 || null,
        paymentDetails?.trackingCode || null,
        paymentDetails?.paidOn || null,
        paymentDetails?.paidTime || null,
        paymentDetails ? new Date() : null
      ]);

      await connection.execute(`
        UPDATE registration_holds
        SET status='CONVERTED',converted_registration_id=?,updated_at=NOW()
        WHERE id=? AND status='ACTIVE'
      `, [registrationResult.insertId, hold.id]);

      await connection.execute(`
        INSERT INTO notifications(user_id,type,title,body,data,created_at)
        VALUES(?,?,?,?,?,NOW())
      `, [
        userId,
        "registration_submitted",
        "ثبت‌نام دریافت شد",
        input.payment === "card_to_card"
          ? `اطلاعات پرداخت مسابقه ${tournament.title} برای بررسی ارسال شد.`
          : `رزرو پرداخت حضوری مسابقه ${tournament.title} ثبت شد.`,
        JSON.stringify({
          paymentId: paymentResult.insertId,
          registrationId: registrationResult.insertId,
          trackingCode
        })
      ]);

      await connection.execute(`
        INSERT INTO notifications(user_id,type,title,body,data,created_at)
        SELECT DISTINCT
          ur.user_id,
          'admin_payment_submitted',
          'پرداخت جدید نیازمند بررسی',
          ?,
          ?,
          NOW()
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id=ur.role_id
        JOIN permissions perm ON perm.id=rp.permission_id
        JOIN users au ON au.id=ur.user_id
        WHERE perm.name IN ('payments.view','payments.approve')
          AND au.status='ACTIVE'
          AND au.deleted_at IS NULL
      `, [
        input.payment === "card_to_card"
          ? `پرداخت جدید برای مسابقه ${tournament.title} ارسال شد.`
          : `رزرو پرداخت حضوری جدید برای مسابقه ${tournament.title} ثبت شد.`,
        JSON.stringify({
          paymentId: paymentResult.insertId,
          registrationId: registrationResult.insertId,
          trackingCode
        })
      ]);

      await connection.commit();

      const trackingPath = `/track/${trackingToken}`;
      const trackingUrl = `${env.appUrl.replace(/\/$/, "")}${trackingPath}`;

      await writeAuditLog({
        actorUserId: userId,
        action: "registration.created_from_hold",
        entityType: "registration",
        entityId: registrationResult.insertId,
        newData: {
          tournamentId: hold.tournament_id,
          holdId: hold.id,
          status: registrationStatus,
          slots: Number(hold.slots),
          playerMobiles: players.map((player) => player.mobile),
          paymentMethod: input.payment,
          paymentSubmitted: Boolean(paymentDetails),
          trackingCode
        },
        request
      });

      try {
        await sendRegistrationTrackingSms({
          mobile: hold.contact_mobile,
          tournamentTitle: tournament.title,
          trackingCode,
          trackingUrl
        });
      } catch (smsError) {
        console.error("registration.tracking.sms.failed", {
          registrationId: registrationResult.insertId,
          error: smsError
        });
      }

      return NextResponse.json({
        ok: true,
        registrationId: registrationPublicId,
        trackingCode,
        trackingToken,
        trackingPath,
        trackingUrl,
        qrToken,
        status: registrationStatus,
        slots: Number(hold.slots),
        paymentId: paymentPublicId,
        receiptToken: input.payment === "card_to_card" ? qrToken : null,
        reservedUntil: input.payment === "card_to_card"
          ? null
          : new Date(Date.now() + tournament.reservation_expires_min * 60_000).toISOString()
      }, { status: 201 });
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // The transaction may already have been committed or rolled back.
      }
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, playerLocks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_METHOD_DISABLED") {
      return NextResponse.json({ message: "این روش پرداخت در حال حاضر غیرفعال است." }, { status: 409 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات ثبت‌نام نامعتبر است.",
        errors: error.issues
      }, { status: 422 });
    }

    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({
        message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید."
      }, { status: 409 });
    }

    if (error instanceof Error && error.message === "TEAM_MEMBER_MOBILE_REQUIRED") {
      return NextResponse.json({
        message: "همه اعضای تیم باید شماره موبایل معتبر داشته باشند."
      }, { status: 422 });
    }

    console.error("registration.create.failed", error);
    return NextResponse.json({ message: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}
