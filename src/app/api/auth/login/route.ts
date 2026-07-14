import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { loadUserAccess, setSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";

const schema = z.object({
  email: z.string().min(3),
  password: z.string().min(4)
});

type UserRow = RowDataPacket & {
  id: number;
  password_hash: string | null;
  status: string;
};

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());

    const rows = await queryRows<UserRow[]>(`
      SELECT id, password_hash, status
      FROM users
      WHERE (email=? OR mobile=?) AND deleted_at IS NULL
      LIMIT 1
    `, [input.email, input.email]);

    const account = rows[0];

    if (!account?.password_hash || !(await compare(input.password, account.password_hash))) {
      return NextResponse.json({ message: "ایمیل، موبایل یا رمز عبور نادرست است." }, { status: 401 });
    }

    if (account.status !== "ACTIVE") {
      return NextResponse.json({ message: "حساب کاربری فعال نیست." }, { status: 403 });
    }

    const user = await loadUserAccess(account.id);
    if (!user) return NextResponse.json({ message: "حساب کاربری معتبر نیست." }, { status: 403 });

    await setSession(user, request);
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ورودی نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "خطای داخلی در ورود." }, { status: 500 });
  }
}
