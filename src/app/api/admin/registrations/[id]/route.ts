import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

const schema = z.object({ status: z.enum(["CONFIRMED", "CHECKED_IN", "NO_SHOW"]) });
type RegistrationRow = RowDataPacket & { id: number; status: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("checkin.manage");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;

    if (env.dataMode === "mock") return NextResponse.json({ ok: true, status: input.status });

    const rows = await queryRows<RegistrationRow[]>(`
      SELECT id,status FROM registrations WHERE id=? AND deleted_at IS NULL LIMIT 1
    `, [id]);
    const registration = rows[0];
    if (!registration) return NextResponse.json({ message: "ثبت‌نام یافت نشد." }, { status: 404 });

    if (["CANCELLED", "REJECTED", "WAITLISTED"].includes(registration.status)) {
      return NextResponse.json({ message: "وضعیت فعلی اجازه ثبت حضور را نمی‌دهد." }, { status: 409 });
    }

    await execute(`
      UPDATE registrations
      SET status=?,
          checked_in_at=IF(?='CHECKED_IN',NOW(),IF(?='CONFIRMED',NULL,checked_in_at)),
          no_show_at=IF(?='NO_SHOW',NOW(),IF(?='CONFIRMED',NULL,no_show_at)),
          updated_at=NOW()
      WHERE id=?
    `, [input.status, input.status, input.status, input.status, input.status, id]);

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "registration.status_changed",
      entityType: "registration",
      entityId: id,
      oldData: { status: registration.status },
      newData: { status: input.status },
      request
    });

    return NextResponse.json({ ok: true, status: input.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "وضعیت انتخاب‌شده نامعتبر است." }, { status: 422 });
    }
    return NextResponse.json({ message: "تغییر وضعیت ثبت‌نام انجام نشد." }, { status: 500 });
  }
}
