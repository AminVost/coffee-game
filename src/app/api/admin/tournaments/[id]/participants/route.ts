import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { inspectTournamentParticipants } from "@/lib/tournament-participants";

const AUTO_RESOLVED_BLOCKERS = new Set(["ACTIVE_HOLDS", "ACTIVE_WAITLIST"]);

function parseTournamentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
  }

  const connection = await db.getConnection();
  try {
    const inspection = await inspectTournamentParticipants(connection, tournamentId);
    if (!inspection) {
      return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
    }
    return NextResponse.json(inspection);
  } catch (error) {
    console.error("tournament.participants.inspect_failed", error);
    return NextResponse.json(
      { message: "دریافت اطلاعات شرکت‌کنندگان انجام نشد." },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
  }

  const connection = await db.getConnection();
  let oldStatus = "";
  try {
    await connection.beginTransaction();

    const [lockedTournament] = await connection.query<Array<RowDataPacket & { status: string }>>(`
      SELECT status
      FROM tournaments
      WHERE id=? AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
    `, [tournamentId]);
    if (!lockedTournament[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
    }
    oldStatus = String(lockedTournament[0].status);

    const before = await inspectTournamentParticipants(connection, tournamentId);
    if (!before) {
      await connection.rollback();
      return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
    }

    const hardBlockers = before.blockers.filter((blocker) => !AUTO_RESOLVED_BLOCKERS.has(blocker.code));
    if (hardBlockers.length) {
      await connection.rollback();
      return NextResponse.json({
        message: "فهرست شرکت‌کنندگان هنوز آماده نهایی‌سازی نیست.",
        blockers: hardBlockers
      }, { status: 409 });
    }

    await connection.execute(`
      UPDATE registration_holds
      SET status='EXPIRED',updated_at=NOW()
      WHERE tournament_id=? AND status='ACTIVE'
    `, [tournamentId]);

    await connection.execute(`
      UPDATE waitlist_entries
      SET status='CANCELLED',cancelled_at=NOW(),updated_at=NOW()
      WHERE tournament_id=? AND status IN ('WAITING','OFFERED')
    `, [tournamentId]);

    await connection.execute(`
      UPDATE registration_entries entry
      JOIN registrations registration ON registration.id=entry.registration_id
      SET entry.confirmed_at=COALESCE(entry.confirmed_at,NOW())
      WHERE registration.tournament_id=?
        AND registration.deleted_at IS NULL
        AND registration.status IN ('CONFIRMED','CHECKED_IN')
    `, [tournamentId]);

    await connection.execute(`
      UPDATE tournaments
      SET status='REGISTRATION_CLOSED',
          registration_ends_at=CASE
            WHEN registration_ends_at IS NULL OR registration_ends_at>NOW() THEN NOW()
            ELSE registration_ends_at
          END,
          updated_at=NOW()
      WHERE id=?
    `, [tournamentId]);

    const after = await inspectTournamentParticipants(connection, tournamentId);
    if (!after || !after.readyForDraw) {
      await connection.rollback();
      return NextResponse.json({
        message: "پس از نهایی‌سازی، فهرست هنوز آماده قرعه نیست.",
        blockers: after?.blockers || []
      }, { status: 409 });
    }

    await connection.commit();

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.participants_finalized",
      entityType: "tournament",
      entityId: String(tournamentId),
      oldData: {
        status: oldStatus,
        finalUnits: before.finalUnits,
        activeHolds: before.activeHolds,
        activeWaitlist: before.activeWaitlist
      },
      newData: {
        status: "REGISTRATION_CLOSED",
        finalUnits: after.finalUnits
      },
      request
    });

    return NextResponse.json({ ok: true, inspection: after });
  } catch (error) {
    await connection.rollback();
    console.error("tournament.participants.finalize_failed", error);
    return NextResponse.json({ message: "نهایی‌سازی شرکت‌کنندگان انجام نشد." }, { status: 500 });
  } finally {
    connection.release();
  }
}
