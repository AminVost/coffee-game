import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { acquirePlayerMobileLocks, findOrCreateGuestPlayer, releasePlayerMobileLocks } from "@/lib/player-identity";

const playerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^09\d{9}$/)
});

const schema = z.object({
  tournamentId: z.string().regex(/^\d+$/),
  players: z.array(playerSchema).min(1).max(20),
  payment: z.enum(["online", "cash", "receipt"]),
  teamTitle: z.string().trim().min(2).max(140).optional()
});

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  capacity: number;
  price: number;
  reservation_expires_min: number;
  waitlist_mode: string;
  allow_multi_slot: number;
  participant_type: "INDIVIDUAL" | "TEAM";
  team_size: number;
  status: string;
};

type CountRow = RowDataPacket & { occupied_slots: number };
type DuplicateRow = RowDataPacket & { mobile: string };
type PositionRow = RowDataPacket & { next_position: number };
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const normalizedPlayers = input.players.map((player) => ({
      name: player.name.trim(),
      mobile: player.mobile.trim()
    }));

    const uniqueMobiles = new Set(normalizedPlayers.map((player) => player.mobile));
    if (uniqueMobiles.size !== normalizedPlayers.length) {
      return NextResponse.json({
        message: "هر شماره موبایل در یک درخواست فقط یک‌بار قابل ثبت است."
      }, { status: 409 });
    }

    const user = await getSession();

    if (env.dataMode === "mock") {
      return NextResponse.json({
        ok: true,
        registrationId: `mock-${Date.now()}`,
        trackingCode: `CGS-${Date.now()}`,
        qrToken: randomUUID(),
        status: "PENDING_PAYMENT",
        paymentId: input.payment === "receipt" ? `mock-payment-${Date.now()}` : null,
        receiptToken: randomUUID()
      }, { status: 201 });
    }

    const connection = await db.getConnection();
    let acquiredMobileLocks: string[] = [];
    try {
      acquiredMobileLocks = await acquirePlayerMobileLocks(connection, normalizedPlayers.map((player) => player.mobile));
      await connection.beginTransaction();

      const [tournaments] = await connection.query<TournamentRow[]>(`
        SELECT id,title,capacity,price,reservation_expires_min,waitlist_mode,
               allow_multi_slot,participant_type,team_size,status
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

      let requestedSlots: number;
      if (tournament.participant_type === "TEAM") {
        if (normalizedPlayers.length !== tournament.team_size) {
          await connection.rollback();
          return NextResponse.json({
            message: `برای ثبت این تیم باید دقیقاً ${tournament.team_size.toLocaleString("fa-IR")} بازیکن وارد شود.`
          }, { status: 422 });
        }
        requestedSlots = 1;
      } else {
        requestedSlots = normalizedPlayers.length;
        if (requestedSlots > 1 && !tournament.allow_multi_slot) {
          await connection.rollback();
          return NextResponse.json({ message: "خرید چند سهم برای این مسابقه فعال نیست." }, { status: 409 });
        }
      }

      const mobiles = normalizedPlayers.map((player) => player.mobile);
      const placeholders = mobiles.map(() => "?").join(",");
      const [duplicates] = await connection.query<DuplicateRow[]>(`
        SELECT DISTINCT p.mobile
        FROM players p
        JOIN registration_entries re ON re.player_id=p.id
        JOIN registrations r ON r.id=re.registration_id
        WHERE r.tournament_id=?
          AND r.deleted_at IS NULL
          AND r.status NOT IN ('CANCELLED','REJECTED','NO_SHOW')
          AND p.mobile IN (${placeholders})
        LIMIT 1
      `, [input.tournamentId, ...mobiles]);

      if (duplicates.length) {
        await connection.rollback();
        return NextResponse.json({
          message: `شماره ${duplicates[0].mobile} قبلاً در این مسابقه ثبت شده است.`
        }, { status: 409 });
      }

      const [counts] = await connection.query<CountRow[]>(`
        SELECT COALESCE(SUM(
          CASE
            WHEN status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN slots
            WHEN status='PENDING_PAYMENT' AND (reserved_until IS NULL OR reserved_until>NOW()) THEN slots
            ELSE 0
          END
        ),0) AS occupied_slots
        FROM registrations
        WHERE tournament_id=? AND deleted_at IS NULL
      `, [input.tournamentId]);

      const occupiedSlots = Number(counts[0]?.occupied_slots || 0);
      const isWaitlisted = occupiedSlots + requestedSlots > tournament.capacity;
      const registrationStatus = isWaitlisted ? "WAITLISTED" : "PENDING_PAYMENT";
      const subtotal = Number(tournament.price) * requestedSlots;
      const registrationPublicId = randomUUID();
      const qrToken = randomUUID();
      const buyerUserId = user?.id && /^\d+$/.test(user.id) ? Number(user.id) : null;

      const [registrationResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO registrations(
          public_id,tournament_id,buyer_user_id,status,slots,subtotal,
          discount_amount,payable_amount,qr_token,reserved_until,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,0,?,?,
          IF(?='WAITLISTED',NULL,DATE_ADD(NOW(),INTERVAL ? MINUTE)),NOW(),NOW())
      `, [
        registrationPublicId,
        input.tournamentId,
        buyerUserId,
        registrationStatus,
        requestedSlots,
        subtotal,
        subtotal,
        qrToken,
        registrationStatus,
        tournament.reservation_expires_min
      ]);

      const playerIds: number[] = [];
      for (const player of normalizedPlayers) {
        playerIds.push(await findOrCreateGuestPlayer(connection, player));
      }

      if (tournament.participant_type === "TEAM") {
        const teamPublicId = randomUUID();
        const teamTitle = input.teamTitle || `تیم ${normalizedPlayers[0].name}`;
        const [teamResult] = await connection.execute<ResultSetHeader>(`
          INSERT INTO teams(public_id,title,created_by_id,created_at,updated_at)
          VALUES(?,?,?,NOW(),NOW())
        `, [teamPublicId, teamTitle, buyerUserId]);

        for (let index = 0; index < playerIds.length; index += 1) {
          await connection.execute(`
            INSERT INTO team_members(team_id,player_id,is_captain,joined_at)
            VALUES(?,?,?,NOW())
          `, [teamResult.insertId, playerIds[index], index === 0 ? 1 : 0]);
        }

        await connection.execute(`
          INSERT INTO registration_entries(registration_id,team_id,confirmed_at)
          VALUES(?,?,NULL)
        `, [registrationResult.insertId, teamResult.insertId]);
      } else {
        for (const playerId of playerIds) {
          await connection.execute(`
            INSERT INTO registration_entries(registration_id,player_id,confirmed_at)
            VALUES(?,?,NULL)
          `, [registrationResult.insertId, playerId]);
        }
      }

      let paymentPublicId: string | null = null;
      if (isWaitlisted) {
        const [positions] = await connection.query<PositionRow[]>(`
          SELECT COALESCE(MAX(we.position),0)+1 AS next_position
          FROM waitlist_entries we
          JOIN registrations r ON r.id=we.registration_id
          WHERE r.tournament_id=?
        `, [input.tournamentId]);
        await connection.execute(`
          INSERT INTO waitlist_entries(registration_id,position)
          VALUES(?,?)
        `, [registrationResult.insertId, Number(positions[0]?.next_position || 1)]);
      } else {
        paymentPublicId = randomUUID();
        await connection.execute(`
          INSERT INTO payments(
            public_id,user_id,registration_id,method,provider,amount,status,created_at,updated_at
          ) VALUES(?,?,?,?,?,?, 'PENDING',NOW(),NOW())
        `, [
          paymentPublicId,
          buyerUserId,
          registrationResult.insertId,
          input.payment,
          input.payment === "online" ? "mock" : null,
          subtotal
        ]);
      }

      await connection.commit();
      await writeAuditLog({
        actorUserId: buyerUserId,
        action: "registration.created",
        entityType: "registration",
        entityId: registrationResult.insertId,
        newData: {
          tournamentId: Number(input.tournamentId),
          status: registrationStatus,
          slots: requestedSlots,
          playerMobiles: mobiles
        },
        request
      });

      return NextResponse.json({
        ok: true,
        registrationId: registrationPublicId,
        trackingCode: `CGS-${registrationPublicId.slice(0, 8).toUpperCase()}`,
        qrToken,
        status: registrationStatus,
        slots: requestedSlots,
        paymentId: paymentPublicId,
        receiptToken: paymentPublicId ? qrToken : null
      }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, acquiredMobileLocks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات ثبت‌نام نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    console.error("registration.create.failed", error);
    return NextResponse.json({ message: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}
