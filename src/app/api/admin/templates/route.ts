import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  gameId: z.number().int().positive(),
  description: z.string().trim().max(500).optional(),
  configuration: z.record(z.string(), z.unknown())
});

export async function GET() {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  const rows = await queryRows<RowDataPacket[]>(`
    SELECT tt.*,g.title AS game_title
    FROM tournament_templates tt
    JOIN games g ON g.id=tt.game_id
    WHERE tt.is_active=1
    ORDER BY tt.updated_at DESC
  `);
  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const auth = await authorize("templates.manage");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const result = await execute(`
      INSERT INTO tournament_templates(game_id,title,description,configuration,is_active,created_by,created_at,updated_at)
      VALUES(?,?,?,?,1,?,NOW(),NOW())
    `, [input.gameId, input.title, input.description || null, JSON.stringify(input.configuration), auth.user.id]);

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament_template.created",
      entityType: "tournament_template",
      entityId: result.insertId,
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, id: String(result.insertId) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "داده قالب نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "ذخیره قالب انجام نشد." }, { status: 500 });
  }
}
