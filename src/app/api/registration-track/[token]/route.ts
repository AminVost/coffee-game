import { NextResponse } from "next/server";
import { findRegistrationTracking } from "@/lib/repositories/registration-tracking";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const item = await findRegistrationTracking(token);
  if (!item) {
    return NextResponse.json({ message: "کد یا لینک پیگیری معتبر نیست." }, { status: 404 });
  }

  return NextResponse.json({ item });
}
