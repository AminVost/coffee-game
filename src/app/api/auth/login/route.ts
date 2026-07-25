import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { loadUserAccess, setSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/runtime-settings";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminLoginChallenge, maskMobile } from "@/lib/admin-2fa";

const schema = z.object({ email: z.string().min(3), password: z.string().min(4) });
type UserRow = RowDataPacket & { id: number; password_hash: string | null; status: string; mobile: string | null };

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await enforceRateLimit(request, "auth.login", 10, 900, input.email.toLowerCase());
    const rows = await queryRows<UserRow[]>(`SELECT id,password_hash,status,mobile FROM users WHERE (email=? OR mobile=?) AND deleted_at IS NULL LIMIT 1`, [input.email, input.email]);
    const account = rows[0];
    if (!account?.password_hash || !(await compare(input.password, account.password_hash))) return NextResponse.json({ message: "ایمیل، موبایل یا رمز عبور نادرست است." }, { status: 401 });
    if (account.status !== "ACTIVE") return NextResponse.json({ message: "حساب کاربری فعال نیست." }, { status: 403 });
    const user = await loadUserAccess(account.id);
    if (!user) return NextResponse.json({ message: "حساب کاربری معتبر نیست." }, { status: 403 });
    const runtimeSettings = await getRuntimeSettings();
    if (user.role === "admin" && runtimeSettings.auth.admin2fa === "required") {
      if (!account.mobile) return NextResponse.json({ message: "برای ورود دومرحله‌ای مدیر، شماره موبایل حساب باید ثبت شود." }, { status: 409 });
      const challenge = await createAdminLoginChallenge(account.id, account.mobile, request);
      return NextResponse.json({ ok: true, requiresOtp: true, challengeToken: challenge.token, mobile: maskMobile(account.mobile), developmentCode: challenge.developmentCode });
    }
    await setSession(user, request);
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED") return NextResponse.json({ message: "تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, { status: 429 });
    if (error instanceof z.ZodError) return NextResponse.json({ message: "ورودی نامعتبر است.", errors: error.issues }, { status: 422 });
    console.error("auth.login.failed", error);
    return NextResponse.json({ message: "خطای داخلی در ورود." }, { status: 500 });
  }
}
