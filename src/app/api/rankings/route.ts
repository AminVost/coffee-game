import { NextRequest, NextResponse } from "next/server";
import { getRankingRows, isActiveRankingGame, isRankingPeriod } from "@/lib/repositories/rankings";

export async function GET(request: NextRequest) {
  const game = request.nextUrl.searchParams.get("game") || "";
  const requestedPeriod = request.nextUrl.searchParams.get("period") || "all_time";

  if (!game || !(await isActiveRankingGame(game))) {
    return NextResponse.json({ message: "بازی انتخاب‌شده معتبر نیست." }, { status: 400 });
  }

  if (!isRankingPeriod(requestedPeriod)) {
    return NextResponse.json({ message: "بازه رنکینگ معتبر نیست." }, { status: 400 });
  }

  const rows = await getRankingRows(game, requestedPeriod);
  return NextResponse.json({ rows, game, period: requestedPeriod });
}
