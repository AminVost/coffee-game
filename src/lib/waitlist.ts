import { randomBytes, randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { createNotification } from "@/lib/notifications";
import { getRuntimeSettings } from "@/lib/runtime-settings";

type CapacityRow = RowDataPacket & { capacity: number; occupied: number };
type WaitlistRow = RowDataPacket & {
  id: number; user_id: number; tournament_id: number; slots: number; title: string;
};

export async function getAvailableSlots(connection: PoolConnection, tournamentId: number, excludeWaitlistId = 0) {
  const [rows] = await connection.query<CapacityRow[]>(`
    SELECT t.capacity,
      COALESCE((SELECT SUM(CASE
        WHEN r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN r.slots
        WHEN r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()) THEN r.slots
        WHEN r.status='NEEDS_CORRECTION' AND r.correction_expires_at>NOW() THEN r.slots ELSE 0 END)
        FROM registrations r WHERE r.tournament_id=t.id AND r.deleted_at IS NULL),0)
      + COALESCE((SELECT SUM(rh.slots) FROM registration_holds rh WHERE rh.tournament_id=t.id AND rh.status='ACTIVE' AND rh.expires_at>NOW()),0)
      + COALESCE((SELECT SUM(w.slots) FROM waitlist_entries w WHERE w.tournament_id=t.id AND w.status='OFFERED' AND w.offer_expires_at>NOW() AND w.id<>?),0) AS occupied
    FROM tournaments t WHERE t.id=? AND t.deleted_at IS NULL LIMIT 1 FOR UPDATE
  `, [excludeWaitlistId, tournamentId]);
  return rows[0] ? Math.max(0, Number(rows[0].capacity) - Number(rows[0].occupied)) : 0;
}

export async function offerNextWaitlistEntries(connection: PoolConnection, tournamentId: number) {
  const runtime = await getRuntimeSettings(connection);
  let available = await getAvailableSlots(connection, tournamentId);
  if (available <= 0) return 0;
  let offered = 0;
  while (available > 0) {
    const [rows] = await connection.query<WaitlistRow[]>(`
      SELECT w.id,w.user_id,w.tournament_id,w.slots,t.title
      FROM waitlist_entries w JOIN tournaments t ON t.id=w.tournament_id
      WHERE w.tournament_id=? AND w.status='WAITING' AND w.cancelled_at IS NULL AND w.user_id IS NOT NULL
      ORDER BY w.position ASC,w.id ASC LIMIT 1 FOR UPDATE
    `, [tournamentId]);
    const item = rows[0];
    if (!item || Number(item.slots) > available) break;
    const offerToken = randomBytes(32).toString("hex");
    await connection.execute(`
      UPDATE waitlist_entries SET status='OFFERED',offer_token=?,offered_at=NOW(),
        offer_expires_at=DATE_ADD(NOW(),INTERVAL ? MINUTE),updated_at=NOW() WHERE id=? AND status='WAITING'
    `, [offerToken, runtime.registration.waitlistOfferMinutes, item.id]);
    await createNotification({
      connection, userId: item.user_id, type: "waitlist_offered", title: "ظرفیت مسابقه برای شما آزاد شد",
      body: `برای مسابقه ${item.title} ظرفیت آزاد شده است. پیشنهاد را پیش از پایان مهلت بپذیرید.`,
      data: { waitlistId: item.id, offerToken, expiresMinutes: runtime.registration.waitlistOfferMinutes }
    });
    available -= Number(item.slots); offered += 1;
  }
  return offered;
}

export async function expireWaitlistOffers(connection: PoolConnection) {
  const [expired] = await connection.query<(RowDataPacket & { tournament_id: number })[]>(`
    SELECT tournament_id FROM waitlist_entries
    WHERE status='OFFERED' AND offer_expires_at IS NOT NULL AND offer_expires_at<=NOW() FOR UPDATE
  `);
  await connection.execute(`
    UPDATE waitlist_entries SET status='EXPIRED',updated_at=NOW()
    WHERE status='OFFERED' AND offer_expires_at IS NOT NULL AND offer_expires_at<=NOW()
  `);
  const tournamentIds = [...new Set(expired.map((row) => Number(row.tournament_id)))];
  for (const tournamentId of tournamentIds) await offerNextWaitlistEntries(connection, tournamentId);
  return expired.length;
}

export function newWaitlistPublicId() { return randomUUID(); }
