import { NextResponse } from "next/server";
import { listLiveMatches } from "@/lib/repositories/live";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    items: await listLiveMatches(),
    updatedAt: new Date().toISOString()
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
