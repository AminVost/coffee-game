import { execute } from "@/lib/db";
import { getRequestIp, getRequestUserAgent } from "@/lib/request-context";

export async function writeAuditLog(input: {
  actorUserId?: string | number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldData?: unknown;
  newData?: unknown;
  request?: Request;
}) {
  await execute(`
    INSERT INTO audit_logs(
      actor_user_id, action, entity_type, entity_id,
      old_data, new_data, ip_address, user_agent, created_at
    ) VALUES(?,?,?,?,?,?,?,?,NOW())
  `, [
    input.actorUserId || null,
    input.action,
    input.entityType,
    input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    input.oldData === undefined ? null : JSON.stringify(input.oldData),
    input.newData === undefined ? null : JSON.stringify(input.newData),
    getRequestIp(input.request),
    getRequestUserAgent(input.request)
  ]);
}
