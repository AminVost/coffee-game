import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { expireStaleRegistrationStateNow } from "@/lib/registration-flow";

type PaymentRow = RowDataPacket & {
  id: number;
  public_id: string;
  registration_public_id: string;
  registration_tracking_code: string | null;
  payer_name: string | null;
  participant_names: string | null;
  participant_mobiles: string | null;
  contact_mobile: string | null;
  tournament_title: string;
  method: string;
  amount: number;
  status: string;
  payer_card_last4: string | null;
  tracking_code: string | null;
  paid_on: string | Date | null;
  paid_time: string | null;
  submitted_at: Date | null;
  rejected_reason: string | null;
  correction_expires_at: Date | null;
  receipt_id: number | null;
  created_at: Date;
  updated_at: Date;
};

function dateOnly(value: string | Date | null) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET() {
  const auth = await authorize("payments.view");
  if (auth.response) return auth.response;

  await expireStaleRegistrationStateNow();

  const rows = await queryRows<PaymentRow[]>(`
    SELECT
      p.id,p.public_id,r.public_id AS registration_public_id,
      r.tracking_code AS registration_tracking_code,
      COALESCE(p.payer_name,u.name,MIN(COALESCE(pl.name,tp.name,tm.title)),'مهمان') AS payer_name,
      GROUP_CONCAT(DISTINCT COALESCE(pl.name,tp.name,tm.title) ORDER BY COALESCE(pl.name,tp.name,tm.title) SEPARATOR '، ') AS participant_names,
      GROUP_CONCAT(DISTINCT COALESCE(pl.mobile,tp.mobile) ORDER BY COALESCE(pl.mobile,tp.mobile) SEPARATOR '، ') AS participant_mobiles,
      r.contact_mobile,
      t.title AS tournament_title,p.method,p.amount,p.status,
      p.payer_card_last4,p.tracking_code,p.paid_on,p.paid_time,p.submitted_at,
      p.rejected_reason,p.correction_expires_at,pr.id AS receipt_id,
      p.created_at,p.updated_at
    FROM payments p
    JOIN registrations r ON r.id=p.registration_id
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN users u ON u.id=COALESCE(p.user_id,r.buyer_user_id)
    LEFT JOIN registration_entries re ON re.registration_id=r.id
    LEFT JOIN players pl ON pl.id=re.player_id
    LEFT JOIN teams tm ON tm.id=re.team_id
    LEFT JOIN team_members tmem ON tmem.team_id=tm.id
    LEFT JOIN players tp ON tp.id=tmem.player_id
    LEFT JOIN payment_receipts pr ON pr.payment_id=p.id
    GROUP BY p.id
    ORDER BY COALESCE(p.submitted_at,p.created_at) DESC,p.id DESC
    LIMIT 500
  `);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      publicId: row.public_id,
      internalReference: `PAY-${String(row.id).padStart(6, "0")}`,
      registrationPublicId: row.registration_public_id,
      registrationTrackingCode: row.registration_tracking_code,
      payerName: row.payer_name || "مهمان",
      participantNames: row.participant_names || row.payer_name || "بدون نام",
      participantMobiles: row.participant_mobiles || "—",
      contactMobile: row.contact_mobile || "—",
      tournamentTitle: row.tournament_title,
      method: row.method,
      amount: Number(row.amount),
      status: row.status,
      cardLast4: row.payer_card_last4,
      trackingCode: row.tracking_code,
      paidOn: dateOnly(row.paid_on),
      paidTime: row.paid_time ? String(row.paid_time).slice(0, 5) : null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      rejectedReason: row.rejected_reason,
      correctionExpiresAt: row.correction_expires_at
        ? new Date(row.correction_expires_at).toISOString()
        : null,
      receiptUrl: row.receipt_id ? `/api/payments/receipts/${row.receipt_id}` : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }))
  });
}
