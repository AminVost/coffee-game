import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  finalizeTournament,
  inspectTournamentCompletion
} from "@/lib/tournament-completion";
import {
  advanceTournament,
  recalculateRankingsForTournament
} from "@/lib/tournament-engine";

const actionSchema = z.object({
  action: z.enum(["sync", "finalize"])
});

function parseTournamentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
    }

    const connection = await db.getConnection();
    try {
      const snapshot = await inspectTournamentCompletion(connection, tournamentId);
      if (!snapshot) {
        return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
      }
      return NextResponse.json(snapshot);
    } finally {
      connection.release();
    }
  } catch {
    return NextResponse.json(
      { message: "دریافت وضعیت پایان مسابقه انجام نشد." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const input = actionSchema.parse(await request.json());
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
    }

    const connection = await db.getConnection();
    let snapshot = null;
    let advancement: unknown = null;
    try {
      await connection.beginTransaction();
      if (input.action === "sync") {
        advancement = await advanceTournament(connection, tournamentId);
        snapshot = await inspectTournamentCompletion(connection, tournamentId);
      } else {
        snapshot = await finalizeTournament(connection, tournamentId);
      }

      if (snapshot?.completed) {
        await recalculateRankingsForTournament(connection, tournamentId);
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
      action: `tournament.completion_${input.action}`,
      entityType: "tournament",
      entityId: String(tournamentId),
      newData: { action: input.action, advancement },
      request
    });

    return NextResponse.json({ ok: true, advancement, snapshot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "عملیات نامعتبر است." }, { status: 422 });
    }
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      TOURNAMENT_NOT_FOUND: "مسابقه یافت نشد.",
      TOURNAMENT_NOT_READY_TO_COMPLETE: "مسابقه هنوز شرایط پایان نهایی را ندارد.",
      AGGREGATE_TIE: "مجموع نتیجه مرحله رفت‌وبرگشت مساوی است و برنده مشخص نشده است.",
      DOUBLE_ELIMINATION_STATE_INVALID: "وضعیت براکت دوحذفی قابل ادامه نیست و باید بررسی شود."
    };
    return NextResponse.json(
      { message: messages[code] || "عملیات پایان مسابقه انجام نشد." },
      { status: messages[code] ? 409 : 500 }
    );
  }
}
