import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { execute, queryRows } from "@/lib/db";
export async function GET(){const user=await getSession();if(!user)return NextResponse.json({message:"ابتدا وارد حساب شوید."},{status:401});const rows=await queryRows<RowDataPacket[]>(`SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200`,[user.id]);return NextResponse.json({items:rows,unread:rows.filter(r=>!r.read_at).length});}
export async function PATCH(){const user=await getSession();if(!user)return NextResponse.json({message:"ابتدا وارد حساب شوید."},{status:401});await execute(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=?`,[user.id]);return NextResponse.json({ok:true});}
export async function DELETE(){const user=await getSession();if(!user)return NextResponse.json({message:"ابتدا وارد حساب شوید."},{status:401});await execute(`DELETE FROM notifications WHERE user_id=? AND read_at IS NOT NULL`,[user.id]);return NextResponse.json({ok:true});}
