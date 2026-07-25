import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const schema = z.object({ matchId: z.coerce.number().int().positive(), reason: z.string().trim().min(10).max(3000) });

type DisputeRow = RowDataPacket & { id:number; match_id:number; status:string; reason:string; resolution:string|null; created_at:Date; tournament_title:string; home_name:string|null; away_name:string|null };

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const rows = await queryRows<DisputeRow[]>(`
    SELECT d.id,d.match_id,d.status,d.reason,d.resolution,d.created_at,t.title AS tournament_title,
      COALESCE(home_team.title,home_player.name) AS home_name,
      COALESCE(away_team.title,away_player.name) AS away_name
    FROM match_disputes d
    JOIN tournament_matches m ON m.id=d.match_id
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN match_participants home_mp ON home_mp.match_id=m.id AND home_mp.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_mp.team_id
    LEFT JOIN players home_player ON home_player.id=home_mp.player_id
    LEFT JOIN match_participants away_mp ON away_mp.match_id=m.id AND away_mp.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_mp.team_id
    LEFT JOIN players away_player ON away_player.id=away_mp.player_id
    WHERE d.submitted_by=?
    ORDER BY d.created_at DESC
  `, [auth.user.id]);
  const eligibleMatches = await queryRows<Array<RowDataPacket & { id:number; tournament_title:string; home_name:string|null; away_name:string|null }>>(`
    SELECT DISTINCT m.id,t.title AS tournament_title,
      COALESCE(home_team.title,home_player.name) AS home_name,
      COALESCE(away_team.title,away_player.name) AS away_name
    FROM tournament_matches m
    JOIN tournaments t ON t.id=m.tournament_id
    JOIN match_participants mine ON mine.match_id=m.id
    LEFT JOIN players mine_player ON mine_player.id=mine.player_id
    LEFT JOIN team_members mine_team_member ON mine_team_member.team_id=mine.team_id
    LEFT JOIN players mine_team_player ON mine_team_player.id=mine_team_member.player_id
    LEFT JOIN match_participants home_mp ON home_mp.match_id=m.id AND home_mp.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_mp.team_id
    LEFT JOIN players home_player ON home_player.id=home_mp.player_id
    LEFT JOIN match_participants away_mp ON away_mp.match_id=m.id AND away_mp.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_mp.team_id
    LEFT JOIN players away_player ON away_player.id=away_mp.player_id
    WHERE m.status IN ('LIVE','COMPLETED')
      AND (mine_player.user_id=? OR mine_team_player.user_id=?)
    ORDER BY m.id DESC LIMIT 100
  `, [auth.user.id, auth.user.id]);
  return NextResponse.json({
    items: rows.map((row) => ({ id:String(row.id), matchId:String(row.match_id), status:row.status, reason:row.reason, resolution:row.resolution, createdAt:new Date(row.created_at).toISOString(), tournament:row.tournament_title, home:row.home_name||"شرکت‌کننده اول", away:row.away_name||"شرکت‌کننده دوم" })),
    matches: eligibleMatches.map((row) => ({ id:String(row.id), title:`${row.tournament_title} · ${row.home_name || "شرکت‌کننده اول"} - ${row.away_name || "شرکت‌کننده دوم"}` }))
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    const input = schema.parse(await request.json());
    const connection = await db.getConnection();
    let disputeId = 0;
    try {
      await connection.beginTransaction();
      const [eligible] = await connection.query<RowDataPacket[]>(`
        SELECT m.id
        FROM tournament_matches m
        JOIN match_participants mp ON mp.match_id=m.id
        LEFT JOIN players p ON p.id=mp.player_id
        LEFT JOIN team_members tm ON tm.team_id=mp.team_id
        LEFT JOIN players team_player ON team_player.id=tm.player_id
        WHERE m.id=? AND m.status IN ('LIVE','COMPLETED')
          AND (p.user_id=? OR team_player.user_id=?)
        LIMIT 1
        FOR UPDATE
      `, [input.matchId, auth.user.id, auth.user.id]);
      if (!eligible[0]) {
        await connection.rollback();
        return NextResponse.json({ message: "فقط شرکت‌کننده این بازی می‌تواند اعتراض ثبت کند." }, { status: 403 });
      }
      const [existing] = await connection.query<RowDataPacket[]>(`
        SELECT id FROM match_disputes WHERE match_id=? AND submitted_by=? AND status='open' LIMIT 1
      `, [input.matchId, auth.user.id]);
      if (existing[0]) {
        await connection.rollback();
        return NextResponse.json({ message: "برای این بازی اعتراض باز دارید." }, { status: 409 });
      }
      const [result] = await connection.execute<import("mysql2").ResultSetHeader>(`
        INSERT INTO match_disputes(match_id,submitted_by,reason,status,created_at)
        VALUES(?,? ,?,'open',NOW())
      `, [input.matchId, auth.user.id, input.reason]);
      disputeId = result.insertId;
      const [managerRows] = await connection.query<Array<RowDataPacket & { user_id:number }>>(`
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id=ur.role_id
        JOIN permissions permission ON permission.id=rp.permission_id
        WHERE permission.name='matches.manage'
      `);
      for (const manager of managerRows) await createNotification({ userId: manager.user_id, type:"match_dispute", title:"اعتراض جدید به نتیجه", body:`اعتراض جدید برای بازی شماره ${input.matchId} ثبت شد.`, data:{ disputeId, matchId:input.matchId }, connection });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    await writeAuditLog({ actorUserId:auth.user.id, action:"match.dispute_created", entityType:"match_dispute", entityId:String(disputeId), newData:input, request });
    return NextResponse.json({ ok:true, id:String(disputeId) }, { status:201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message:"متن اعتراض باید حداقل ۱۰ کاراکتر باشد.", errors:(error as { issues: unknown[] }).issues }, { status:422 });
    return NextResponse.json({ message:"ثبت اعتراض انجام نشد." }, { status:500 });
  }
}
