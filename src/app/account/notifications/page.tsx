import { Bell, CheckCircle2, XCircle } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";

type NotificationRow = RowDataPacket & {
  id: number;
  type: string;
  title: string;
  body: string;
  created_at: Date;
};

export default async function Notifications() {
  const user = await getSession();
  let items: Array<{ id: string; type: string; title: string; body: string; createdAt: string }> = [];

  if (user?.id) {
    const rows = await queryRows<NotificationRow[]>(`
      SELECT id,type,title,body,created_at
      FROM notifications
      WHERE user_id=?
      ORDER BY created_at DESC
      LIMIT 100
    `, [user.id]);
    items = rows.map((row) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString()
    }));
  }

  return <div>
    <p className="section-kicker">NOTIFICATIONS</p>
    <h1 className="section-title mt-2">اعلان‌ها</h1>
    <div className="mt-7 grid gap-3">
      {items.map((item) => {
        const Icon = item.type === "payment_approved" ? CheckCircle2 : item.type === "payment_rejected" ? XCircle : Bell;
        return <Card key={item.id} className="flex items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)]"><Icon size={19} /></span>
          <div><strong>{item.title}</strong><p className="mt-1 text-sm leading-7 text-[var(--muted)]">{item.body}</p><time className="mt-2 block text-[11px] text-[var(--muted)]">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time></div>
        </Card>;
      })}
      {!items.length && <Card className="p-10 text-center text-[var(--muted)]">اعلانی وجود ندارد.</Card>}
    </div>
  </div>;
}
