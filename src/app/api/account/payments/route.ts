import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

type PaymentRow = RowDataPacket & {
  id: number;
  public_id: string;
  tournament_title: string;
  amount: number;
  method: string;
  status: string;
  rejected_reason: string | null;
  receipt_id: number | null;
};

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({ items: [{ id: "mock-payment", publicId: "mock-payment", tournamentTitle: "جام جمعه FC 26", amount: 350000, method: "receipt", status: "PENDING", rejectedReason: null, receiptUrl: null }] });
  }

  const rows = await queryRows<PaymentRow[]>(`
    SELECT p.id,p.public_id,t.title AS tournament_title,p.amount,p.method,p.status,p.rejected_reason,pr.id AS receipt_id
    FROM payments p
    JOIN registrations r ON r.id=p.registration_id
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN payment_receipts pr ON pr.payment_id=p.id
    WHERE p.user_id=? OR r.buyer_user_id=?
    ORDER BY p.created_at DESC
  `, [auth.user.id, auth.user.id]);

  return NextResponse.json({ items: rows.map((row) => ({
    id: String(row.id),
    publicId: row.public_id,
    tournamentTitle: row.tournament_title,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    rejectedReason: row.rejected_reason,
    receiptUrl: row.receipt_id ? `/api/payments/receipts/${row.receipt_id}` : null
  })) });
}
