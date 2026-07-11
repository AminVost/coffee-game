import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  status: z.enum(["DRAFT","PUBLISHED","REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_READY","RUNNING","COMPLETED","POSTPONED","CANCELLED"]).optional()
}).refine((input) => Object.keys(input).length > 0, "حداقل یک تغییر لازم است.");

type TournamentRow = RowDataPacket & { id: number; title: string; status: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const input = patchSchema.parse(await request.json());

    if (env.dataMode === "mock") return NextResponse.json({ ok: true, id, data: input });

    const rows = await queryRows<TournamentRow[]>(`SELECT id,title,status FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1`, [id]);
    if (!rows[0]) return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });

    await execute(`
      UPDATE tournaments
      SET title=COALESCE(?,title),status=COALESCE(?,status),
          published_at=IF(? IN ('PUBLISHED','REGISTRATION_OPEN') AND published_at IS NULL,NOW(),published_at),
          updated_at=NOW()
      WHERE id=?
    `, [input.title || null, input.status || null, input.status || null, id]);

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.updated",
      entityType: "tournament",
      entityId: id,
      oldData: rows[0],
      newData: input,
      request
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات ویرایش نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "ویرایش مسابقه انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;
  const { id } = await params;

  if (env.dataMode !== "mock") {
    await execute(`UPDATE tournaments SET deleted_at=NOW(),updated_at=NOW() WHERE id=? AND deleted_at IS NULL`, [id]);
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.deleted",
      entityType: "tournament",
      entityId: id,
      request
    });
  }

  return NextResponse.json({ ok: true });
}
