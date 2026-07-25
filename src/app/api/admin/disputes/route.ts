import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";

type Row = RowDataPacket & { id:number; match_id:number; status:string; reason:string; resolution:string|null; created_at:Date; submitter_name:string|null; tournament_title:string; home_name:string|null; away_name:string|null };
export async function GET() {
  const auth=await authorize("matches.manage"); if(auth.response)return auth.response;
  const rows=await queryRows<Row[]>(`
    SELECT d.id,d.match_id,d.status,d.reason,d.resolution,d.created_at,u.name AS submitter_name,t.title AS tournament_title,
      COALESCE(ht.title,hp.name) AS home_name,COALESCE(at.title,ap.name) AS away_name
    FROM match_disputes d
    JOIN tournament_matches m ON m.id=d.match_id JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN users u ON u.id=d.submitted_by
    LEFT JOIN match_participants hmp ON hmp.match_id=m.id AND hmp.slot=1 LEFT JOIN teams ht ON ht.id=hmp.team_id LEFT JOIN players hp ON hp.id=hmp.player_id
    LEFT JOIN match_participants amp ON amp.match_id=m.id AND amp.slot=2 LEFT JOIN teams at ON at.id=amp.team_id LEFT JOIN players ap ON ap.id=amp.player_id
    ORDER BY FIELD(d.status,'open','accepted','rejected','resolved'),d.created_at DESC LIMIT 300
  `);
  return NextResponse.json({items:rows.map(r=>({id:String(r.id),matchId:String(r.match_id),status:r.status,reason:r.reason,resolution:r.resolution,createdAt:new Date(r.created_at).toISOString(),submitter:r.submitter_name||"کاربر",tournament:r.tournament_title,home:r.home_name||"شرکت‌کننده اول",away:r.away_name||"شرکت‌کننده دوم"}))});
}
