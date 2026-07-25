import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
const schema=z.object({status:z.enum(["accepted","rejected","resolved"]),resolution:z.string().trim().min(3).max(3000)});
type Row=RowDataPacket&{id:number;submitted_by:number|null;status:string};
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authorize("matches.manage");if(auth.response)return auth.response;try{const input=schema.parse(await request.json());const{id}=await params;const connection=await db.getConnection();let old:Row|null=null;try{await connection.beginTransaction();const[rows]=await connection.query<Row[]>(`SELECT id,submitted_by,status FROM match_disputes WHERE id=? LIMIT 1 FOR UPDATE`,[id]);old=rows[0]||null;if(!old){await connection.rollback();return NextResponse.json({message:"اعتراض یافت نشد."},{status:404})}await connection.execute(`UPDATE match_disputes SET status=?,resolution=?,resolved_by=?,resolved_at=NOW() WHERE id=?`,[input.status,input.resolution,auth.user.id,id]);await createNotification({userId:old.submitted_by,type:"match_dispute_resolved",title:"پاسخ اعتراض ثبت شد",body:input.resolution,data:{disputeId:id,status:input.status},connection});await connection.commit()}catch(error){await connection.rollback();throw error}finally{connection.release()}await writeAuditLog({actorUserId:auth.user.id,action:"match.dispute_resolved",entityType:"match_dispute",entityId:id,oldData:old||undefined,newData:input,request});return NextResponse.json({ok:true})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({message:"پاسخ اعتراض نامعتبر است."},{status:422});return NextResponse.json({message:"رسیدگی به اعتراض انجام نشد."},{status:500})}}
