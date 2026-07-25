import type { RowDataPacket } from "mysql2";
import { NotificationsManager } from "@/components/account/notifications-manager";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";
type Row=RowDataPacket&{id:number;type:string;title:string;body:string;read_at:Date|null;created_at:Date};
export default async function Notifications(){const user=await getSession();const rows=user?await queryRows<Row[]>(`SELECT id,type,title,body,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200`,[user.id]):[];return <div><p className="section-kicker">NOTIFICATIONS</p><h1 className="section-title mt-2">اعلان‌ها</h1><div className="mt-7"><NotificationsManager initialItems={rows.map(r=>({id:String(r.id),type:r.type,title:r.title,body:r.body,readAt:r.read_at?new Date(r.read_at).toISOString():null,createdAt:new Date(r.created_at).toISOString()}))}/></div></div>}
