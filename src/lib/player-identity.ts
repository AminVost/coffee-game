import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export type PlayerIdentityRow = RowDataPacket & {
  id: number;
  user_id: number | null;
  name: string;
  mobile: string | null;
  is_guest: number;
};

type LockRow = RowDataPacket & { acquired: number | null };

function lockName(mobile: string) {
  return `cgs:player-mobile:${mobile}`;
}

export async function acquirePlayerMobileLocks(connection: PoolConnection, mobiles: string[]) {
  const acquired: string[] = [];
  const uniqueMobiles = [...new Set(mobiles.filter(Boolean))].sort();

  try {
    for (const mobile of uniqueMobiles) {
      const [rows] = await connection.query<LockRow[]>(`SELECT GET_LOCK(?,10) AS acquired`, [lockName(mobile)]);
      if (Number(rows[0]?.acquired) !== 1) throw new Error("PLAYER_IDENTITY_LOCK_TIMEOUT");
      acquired.push(mobile);
    }
    return acquired;
  } catch (error) {
    await releasePlayerMobileLocks(connection, acquired);
    throw error;
  }
}

export async function releasePlayerMobileLocks(connection: PoolConnection, mobiles: string[]) {
  for (const mobile of [...mobiles].reverse()) {
    await connection.query(`SELECT RELEASE_LOCK(?)`, [lockName(mobile)]).catch(() => undefined);
  }
}

export async function findOrCreateGuestPlayer(
  connection: PoolConnection,
  player: { name: string; mobile: string }
) {
  const [existing] = await connection.query<PlayerIdentityRow[]>(`
    SELECT id,user_id,name,mobile,is_guest
    FROM players
    WHERE mobile=?
    ORDER BY user_id IS NOT NULL DESC,id ASC
    LIMIT 1
    FOR UPDATE
  `, [player.mobile]);

  if (existing[0]) {
    if (existing[0].is_guest && !existing[0].user_id && existing[0].name !== player.name) {
      await connection.execute(`UPDATE players SET name=?,updated_at=NOW() WHERE id=?`, [player.name, existing[0].id]);
    }
    return existing[0].id;
  }

  const [created] = await connection.execute<ResultSetHeader>(`
    INSERT INTO players(name,mobile,is_guest,created_at,updated_at)
    VALUES(?,?,1,NOW(),NOW())
  `, [player.name, player.mobile]);

  return created.insertId;
}

export async function ensureUserPlayer(
  connection: PoolConnection,
  user: { id: number; name: string; mobile?: string | null }
) {
  const [byUser] = await connection.query<PlayerIdentityRow[]>(`
    SELECT id,user_id,name,mobile,is_guest
    FROM players
    WHERE user_id=?
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `, [user.id]);

  if (byUser[0]) {
    await connection.execute(`
      UPDATE players
      SET name=?,mobile=COALESCE(?,mobile),is_guest=0,updated_at=NOW()
      WHERE id=?
    `, [user.name, user.mobile || null, byUser[0].id]);
    return byUser[0].id;
  }

  if (user.mobile) {
    const [byMobile] = await connection.query<PlayerIdentityRow[]>(`
      SELECT id,user_id,name,mobile,is_guest
      FROM players
      WHERE mobile=?
      ORDER BY user_id IS NOT NULL DESC,id ASC
      LIMIT 1
      FOR UPDATE
    `, [user.mobile]);

    if (byMobile[0]) {
      if (byMobile[0].user_id && byMobile[0].user_id !== user.id) {
        throw new Error("PLAYER_MOBILE_ALREADY_LINKED");
      }
      await connection.execute(`
        UPDATE players SET user_id=?,name=?,is_guest=0,updated_at=NOW() WHERE id=?
      `, [user.id, user.name, byMobile[0].id]);
      return byMobile[0].id;
    }
  }

  const [created] = await connection.execute<ResultSetHeader>(`
    INSERT INTO players(user_id,name,mobile,is_guest,created_at,updated_at)
    VALUES(?,?,?,0,NOW(),NOW())
  `, [user.id, user.name, user.mobile || null]);

  return created.insertId;
}
