import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

const schema = z.object({
  club: z.object({ name: z.string().trim().min(2).max(160), phone: z.string().trim().max(30), address: z.string().trim().max(500) }),
  auth: z.object({ admin2fa: z.enum(["optional", "required"]) }),
  payment: z.object({ cash: z.boolean(), receipt: z.boolean(), partial: z.boolean() }),
  notification: z.object({ inApp: z.boolean(), email: z.boolean(), sms: z.enum(["disabled", "optional", "required"]) })
});

type SettingRow = RowDataPacket & { key: string; value: unknown };

const mockSettings = {
  club: { name: "Coffee Game ستارخان", phone: "02100000000", address: "تهران، ستارخان" },
  auth: { admin2fa: "optional" as const },
  payment: { cash: true, receipt: true, partial: false },
  notification: { inApp: true, email: false, sms: "optional" as const }
};

export async function GET() {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;
  if (env.dataMode === "mock") return NextResponse.json({ item: mockSettings });

  const rows = await queryRows<SettingRow[]>(`
    SELECT \`key\`,value FROM app_settings
    WHERE \`key\` IN ('club.profile','auth.settings','payment.settings','notification.settings')
  `);
  const map = Object.fromEntries(rows.map((row) => [row.key, typeof row.value === "string" ? JSON.parse(row.value) : row.value]));
  return NextResponse.json({ item: {
    club: map["club.profile"] || mockSettings.club,
    auth: { admin2fa: map["auth.settings"]?.admin2fa || "optional" },
    payment: {
      cash: Boolean(map["payment.settings"]?.cash),
      receipt: Boolean(map["payment.settings"]?.receipt),
      partial: Boolean(map["payment.settings"]?.partial)
    },
    notification: {
      inApp: Boolean(map["notification.settings"]?.inApp),
      email: Boolean(map["notification.settings"]?.email),
      sms: map["notification.settings"]?.sms || "optional"
    }
  } });
}

export async function PUT(request: Request) {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;
  try {
    const input = schema.parse(await request.json());
    if (env.dataMode !== "mock") {
      const settings: Array<[string, unknown, number]> = [
        ["club.profile", input.club, 1],
        ["auth.settings", { password: true, sms: true, google: false, admin2fa: input.auth.admin2fa }, 0],
        ["payment.settings", { provider: process.env.PAYMENT_PROVIDER || "mock", ...input.payment }, 0],
        ["notification.settings", input.notification, 0]
      ];
      for (const [key, value, isPublic] of settings) {
        await execute(`
          INSERT INTO app_settings(\`key\`,value,is_public,updated_at)
          VALUES(?,?,?,NOW())
          ON DUPLICATE KEY UPDATE value=VALUES(value),is_public=VALUES(is_public),updated_at=NOW()
        `, [key, JSON.stringify(value), isPublic]);
      }
      await writeAuditLog({ actorUserId: auth.user.id, action: "settings.updated", entityType: "app_settings", entityId: "main", newData: input, request });
    }
    return NextResponse.json({ ok: true, item: input });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "تنظیمات واردشده معتبر نیست.", errors: error.issues }, { status: 422 });
    return NextResponse.json({ message: "ذخیره تنظیمات انجام نشد." }, { status: 500 });
  }
}
