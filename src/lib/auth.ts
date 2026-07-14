import { createHash, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { execute, queryRows } from "@/lib/db";
import { assertAuthConfiguration, env } from "@/lib/env";
import { getRequestIp, getRequestUserAgent } from "@/lib/request-context";

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  role: "admin" | "player";
  roles: string[];
  permissions: string[];
  sessionId?: string;
};

type UserAccessRow = RowDataPacket & {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  status: string;
  roles: string | null;
  permissions: string | null;
};

type ActiveSessionRow = RowDataPacket & { user_id: number };

function authKey() {
  assertAuthConfiguration();
  return new TextEncoder().encode(env.authSecret);
}
const cookieName = "cgs_session";
const sessionSeconds = 60 * 60 * 24 * env.sessionDays;

function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

function splitCsv(value: string | null) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function mapAccess(row: UserAccessRow, sessionId?: string): SessionUser {
  const roles = splitCsv(row.roles);
  const permissions = splitCsv(row.permissions);
  const isAdmin = roles.some((role) => !["player", "guest"].includes(role));

  return {
    id: String(row.id),
    name: row.name,
    email: row.email || undefined,
    mobile: row.mobile || undefined,
    role: isAdmin ? "admin" : "player",
    roles,
    permissions,
    sessionId
  };
}

export async function loadUserAccess(userId: string | number, sessionId?: string) {
  const rows = await queryRows<UserAccessRow[]>(`
    SELECT u.id,u.name,u.email,u.mobile,u.status,
      GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles,
      GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ',') AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id=u.id
    LEFT JOIN roles r ON r.id=ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id=r.id
    LEFT JOIN permissions p ON p.id=rp.permission_id
    WHERE u.id=? AND u.deleted_at IS NULL AND u.status='ACTIVE'
    GROUP BY u.id
    LIMIT 1
  `, [userId]);

  return rows[0] ? mapAccess(rows[0], sessionId) : null;
}

export function hasPermission(user: SessionUser | null, permission: string) {
  return Boolean(user && (user.permissions.includes("*") || user.permissions.includes(permission)));
}

async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.sessionDays}d`)
    .sign(authKey());
}

export async function setSession(user: SessionUser, request?: Request) {
  const sessionId = randomUUID();
  const tokenHash = hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + sessionSeconds * 1000);

  await execute(`
    INSERT INTO sessions(token_hash,user_id,ip_address,user_agent,expires_at,created_at)
    VALUES(?,?,?,?,?,NOW())
  `, [
    tokenHash,
    Number(user.id),
    getRequestIp(request),
    getRequestUserAgent(request),
    expiresAt
  ]);

  const token = await createSessionToken({ ...user, sessionId });
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionSeconds
  });
}

async function readTokenPayload() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, authKey());
  return payload as unknown as SessionUser;
}

export async function clearSession() {
  try {
    const payload = await readTokenPayload();
    if (payload?.sessionId) {
      await execute(`
        UPDATE sessions SET revoked_at=COALESCE(revoked_at,NOW())
        WHERE token_hash=?
      `, [hashSessionId(payload.sessionId)]);
    }
  } catch {
    // The cookie is still removed when the token is malformed or expired.
  }

  const store = await cookies();
  store.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const payload = await readTokenPayload();
    if (!payload?.id || !payload.name || !payload.sessionId || !/^\d+$/.test(payload.id)) return null;

    const sessionRows = await queryRows<ActiveSessionRow[]>(`
      SELECT s.user_id
      FROM sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=?
        AND s.user_id=?
        AND s.revoked_at IS NULL
        AND s.expires_at>NOW()
        AND u.status='ACTIVE'
        AND u.deleted_at IS NULL
      LIMIT 1
    `, [hashSessionId(payload.sessionId), Number(payload.id)]);

    if (!sessionRows[0]) return null;
    return await loadUserAccess(payload.id, payload.sessionId);
  } catch {
    return null;
  }
}

export async function revokeAllUserSessions(userId: string | number, exceptSessionId?: string) {
  if (exceptSessionId) {
    await execute(`
      UPDATE sessions SET revoked_at=NOW()
      WHERE user_id=? AND revoked_at IS NULL AND token_hash<>?
    `, [userId, hashSessionId(exceptSessionId)]);
    return;
  }

  await execute(`UPDATE sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL`, [userId]);
}

export function currentSessionHash(user: SessionUser) {
  return user.sessionId ? hashSessionId(user.sessionId) : null;
}

export { cookieName, hashSessionId };
