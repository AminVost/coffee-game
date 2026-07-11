import { NextResponse } from "next/server";
import { env } from "@/lib/env";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({ok:true,service:"coffee-game-satarkhan",mode:env.dataMode,time:new Date().toISOString()})}
