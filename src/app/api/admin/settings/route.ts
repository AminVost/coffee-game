import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";

const schema = z.object({
  club: z.object({
    name: z.string().trim().min(2).max(160),
    phone: z.string().trim().max(30),
    address: z.string().trim().max(500)
  }),
  auth: z.object({ admin2fa: z.enum(["optional", "required"]) }),
  payment: z.object({ cash: z.boolean(), receipt: z.boolean(), partial: z.boolean() }),
  notification: z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    sms: z.enum(["disabled", "optional", "required"])
  })
});

type SettingRow = RowDataPacket & { key: string; value: unknown };

type SettingsMap = {
  "club.profile"?: { name: string; phone: string; address: string };
  "auth.settings"?: { admin2fa: "optional" | "required" };
  "payment.settings"?: { cash: boolean; receipt: boolean; partial: boolean };
  "notification.settings"?: {
    inApp: boolean;
    email: boolean;
    sms: "disabled" | "optional" | "required";
  };
};

function parseValue(value: unknown) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

export async function GET() {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;

  const rows = await queryRows<SettingRow[]>(`
    SELECT \`key\`,value FROM app_settings
    WHERE \`key\` IN ('club.profile','auth.settings','payment.settings','notification.settings')
  `);
  const map = Object.fromEntries(rows.map((row) => [row.key, parseValue(row.value)])) as SettingsMap;

  const requiredKeys = ["club.profile", "auth.settings", "payment.settings", "notification.settings"] as const;
  const missing = requiredKeys.filter((key) => !map[key]);
  if (missing.length) {
    return NextResponse.json({
      message: "تنظیمات پایه دیتابیس ناقص است.",
      missing
    }, { status: 500 });
  }

  const club = map["club.profile"]!;
  const authSettings = map["auth.settings"]!;
  const paymentSettings = map["payment.settings"]!;
  const notificationSettings = map["notification.settings"]!;

  return NextResponse.json({
    item: {
      club,
      auth: { admin2fa: authSettings.admin2fa },
      payment: {
        cash: Boolean(paymentSettings.cash),
        receipt: Boolean(paymentSettings.receipt),
        partial: Boolean(paymentSettings.partial)
      },
      notification: {
        inApp: Boolean(notificationSettings.inApp),
        email: Boolean(notificationSettings.email),
        sms: notificationSettings.sms
      }
    }
  });
}

export async function PUT(request: Request) {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const settings: Array<[string, unknown, number]> = [
      ["club.profile", input.club, 1],
      ["auth.settings", { password: true, sms: true, google: false, admin2fa: input.auth.admin2fa }, 0],
      ["payment.settings", { provider: "manual_transfer", ...input.payment }, 0],
      ["notification.settings", input.notification, 0]
    ];

    for (const [key, value, isPublic] of settings) {
      await execute(`
        INSERT INTO app_settings(\`key\`,value,is_public,updated_at)
        VALUES(?,?,?,NOW())
        ON DUPLICATE KEY UPDATE value=VALUES(value),is_public=VALUES(is_public),updated_at=NOW()
      `, [key, JSON.stringify(value), isPublic]);
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "settings.updated",
      entityType: "app_settings",
      entityId: "main",
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, item: input });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "تنظیمات واردشده معتبر نیست.", errors: error.issues }, { status: 422 });
    }
    console.error("admin.settings.update.failed", error);
    return NextResponse.json({ message: "ذخیره تنظیمات انجام نشد." }, { status: 500 });
  }
}
