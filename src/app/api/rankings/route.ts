import { NextRequest, NextResponse } from "next/server";
import { backgammonRankings, fcRankings } from "@/data/mock-data";
import { env } from "@/lib/env";
import { getRankingRows, isRankingPeriod } from "@/lib/repositories/rankings";

export async function GET(request: NextRequest) {
  const game = request.nextUrl.searchParams.get("game") || "fc26";
  const requestedPeriod = request.nextUrl.searchParams.get("period") || "all_time";

  if (!["fc26", "backgammon"].includes(game)) {
    return NextResponse.json({ message: "بازی انتخاب‌شده معتبر نیست." }, { status: 400 });
  }

  if (!isRankingPeriod(requestedPeriod)) {
    return NextResponse.json({ message: "بازه رنکینگ معتبر نیست." }, { status: 400 });
  }

  if (env.dataMode === "mock") {
    return NextResponse.json({
      rows: game === "fc26" ? fcRankings : backgammonRankings,
      game,
      period: requestedPeriod
    });
  }

  const rows = await getRankingRows(game, requestedPeriod);
  return NextResponse.json({ rows, game, period: requestedPeriod });
}
