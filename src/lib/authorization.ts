import { NextResponse } from "next/server";
import { getSession, hasPermission, type SessionUser } from "@/lib/auth";

export type AuthorizationResult =
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse };

export async function authorize(permission?: string): Promise<AuthorizationResult> {
  const user = await getSession();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ message: "ابتدا وارد حساب کاربری شوید." }, { status: 401 })
    };
  }

  if (permission && !hasPermission(user, permission)) {
    return {
      user: null,
      response: NextResponse.json({ message: "برای انجام این عملیات دسترسی کافی ندارید." }, { status: 403 })
    };
  }

  return { user, response: null };
}
