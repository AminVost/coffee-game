import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db, execute } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { expireStaleRegistrationState } from "@/lib/registration-flow";

function authorized(request: Request) {
  const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||""; const expected=env.maintenanceSecret;
  return Boolean(supplied&&expected&&supplied.length===expected.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)));
}

export async function POST(request: Request) {
  if(!authorized(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{
    const connection=await db.getConnection(); let affectedTournaments:number[]=[]; let expiredOffers=0;
    try{
      await connection.beginTransaction();
      const expiration=await expireStaleRegistrationState(connection);
      affectedTournaments=expiration.affectedTournaments;
      expiredOffers=expiration.expiredWaitlistOffers;
      await connection.commit();
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
    const consumedOtps=await execute(`UPDATE otp_codes SET consumed_at=COALESCE(consumed_at,NOW()) WHERE consumed_at IS NULL AND expires_at<=NOW()`);
    const expiredTeamInvitations=await execute(`UPDATE team_invitations SET status='EXPIRED',updated_at=NOW() WHERE status='PENDING' AND expires_at<=NOW()`);
    const oldChallenges=await execute(`DELETE FROM admin_login_challenges WHERE expires_at<DATE_SUB(NOW(),INTERVAL 1 DAY) OR consumed_at<DATE_SUB(NOW(),INTERVAL 1 DAY)`);
    const oldRateLimits=await execute(`DELETE FROM rate_limits WHERE updated_at<DATE_SUB(NOW(),INTERVAL 2 DAY)`);
    const oldSessions=await execute(`DELETE FROM sessions WHERE expires_at<DATE_SUB(NOW(),INTERVAL 30 DAY) OR revoked_at<DATE_SUB(NOW(),INTERVAL 30 DAY)`);
    const result={affectedTournaments:affectedTournaments.length,expiredWaitlistOffers:expiredOffers,expiredTeamInvitations:expiredTeamInvitations.affectedRows,consumedOtps:consumedOtps.affectedRows,oldChallenges:oldChallenges.affectedRows,oldRateLimits:oldRateLimits.affectedRows,oldSessions:oldSessions.affectedRows};
    logger.info("maintenance.completed",result); return NextResponse.json({ok:true,result});
  }catch(error){logger.error("maintenance.failed",error);return NextResponse.json({message:"Maintenance failed"},{status:500});}
}
