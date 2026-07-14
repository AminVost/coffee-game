import { NextResponse } from "next/server";
import { authorize } from "@/lib/authorization";
import { getAdminDashboardData } from "@/lib/repositories/admin-dashboard";

export async function GET() {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  return NextResponse.json(await getAdminDashboardData());
}
