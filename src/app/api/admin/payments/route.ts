import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { recentRegistrations } from "@/data/mock-data";

type PaymentRow = RowDataPacket & {
  id: number;
  public_id: string;
  payer_name: string | null;
  tournament_title: string;
  method: string;
  amount: number;
  status: string;
  rejected_reason: string | null;
  receipt_id: number | null;
  created_at: Date;
};

export async function GET() {
  const auth = await authorize("payments.view");
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({
      items: recentRegistrations.map((item, index) => ({
        id: `mock-${index}`,
        publicId: `mock-${index}`,
        payerName: item.name,
        tournamentTitle: item.tournament,
        method: index % 2 ? "receipt" : "online",
        amount: Number(item.amount.replaceAll(",", "")),
        status: "PENDING",
        receiptUrl: index % 2 ? "#" : null,
        createdAt: new Date().toISOString()
      }))
    });
  }

  const rows = await queryRows<PaymentRow[]>(`
    SELECT p.id,p.public_id,COALESCE(u.name,pl.name,'مهمان') AS payer_name,
           t.title AS tournament_title,p.method,p.amount,p.status,p.rejected_reason,
           pr.id AS receipt_id,p.created_at
    FROM payments p
    JOIN registrations r ON r.id=p.registration_id
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN users u ON u.id=COALESCE(p.user_id,r.buyer_user_id)
    LEFT JOIN registration_entries re ON re.registration_id=r.id
    LEFT JOIN players pl ON pl.id=re.player_id
    LEFT JOIN payment_receipts pr ON pr.payment_id=p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 200
  `);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      publicId: row.public_id,
      payerName: row.payer_name || "مهمان",
      tournamentTitle: row.tournament_title,
      method: row.method,
      amount: Number(row.amount),
      status: row.status,
      rejectedReason: row.rejected_reason,
      receiptUrl: row.receipt_id ? `/api/payments/receipts/${row.receipt_id}` : null,
      createdAt: new Date(row.created_at).toISOString()
    }))
  });
}
