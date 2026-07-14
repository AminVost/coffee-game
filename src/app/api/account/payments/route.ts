import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { expireStaleRegistrationStateNow } from "@/lib/registration-flow";

type PaymentRow = RowDataPacket & {
  id: number;
  public_id: string;
  tournament_title: string;
  amount: number;
  method: string;
  status: string;
  payer_name: string | null;
  payer_card_last4: string | null;
  tracking_code: string | null;
  paid_on: string | Date | null;
  paid_time: string | null;
  submitted_at: Date | null;
  rejected_reason: string | null;
  correction_expires_at: Date | null;
  receipt_id: number | null;
  registration_tracking_code: string | null;
  registration_tracking_token: string | null;
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
  const auth = await authorize();
  if (auth.response) return auth.response;

  await expireStaleRegistrationStateNow();

  const rows = await queryRows<PaymentRow[]>(`
    SELECT
      p.id,p.public_id,t.title AS tournament_title,p.amount,p.method,p.status,
      p.payer_name,p.payer_card_last4,p.tracking_code,p.paid_on,p.paid_time,
      p.submitted_at,p.rejected_reason,p.correction_expires_at,
      pr.id AS receipt_id,r.tracking_code AS registration_tracking_code,
      r.tracking_token AS registration_tracking_token
    FROM payments p
    JOIN registrations r ON r.id=p.registration_id
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN payment_receipts pr ON pr.payment_id=p.id
    WHERE p.user_id=? OR r.buyer_user_id=?
    ORDER BY COALESCE(p.submitted_at,p.created_at) DESC,p.id DESC
  `, [auth.user.id, auth.user.id]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      publicId: row.public_id,
      tournamentTitle: row.tournament_title,
      amount: Number(row.amount),
      method: row.method,
      status: row.status,
      payerName: row.payer_name,
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
      registrationTrackingCode: row.registration_tracking_code,
      trackingPath: row.registration_tracking_token
        ? `/track/${row.registration_tracking_token}`
        : null
    }))
  });
}
