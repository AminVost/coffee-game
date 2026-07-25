import type { PoolConnection } from "mysql2/promise";
import { execute } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/runtime-settings";

export async function createNotification(input: { userId?: string | number | null; type: string; title: string; body: string; data?: unknown; connection?: PoolConnection }) {
  if (!input.userId) return;
  const { notification } = await getRuntimeSettings(input.connection);
  if (!notification.inApp) return;
  const sql = `INSERT INTO notifications(user_id,type,title,body,data,created_at) VALUES(?,?,?,?,?,NOW())`;
  const params = [input.userId, input.type, input.title, input.body, input.data === undefined ? null : JSON.stringify(input.data)];
  if (input.connection) await input.connection.execute(sql, params);
  else await execute(sql, params);
}
