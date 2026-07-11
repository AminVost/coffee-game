import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

type ReceiptRow = RowDataPacket & {
  id: number;
  file_path: string;
  mime_type: string;
  user_id: number | null;
  buyer_user_id: number | null;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { id } = await params;

  if (env.dataMode === "mock") {
    return NextResponse.json({ message: "در حالت Mock فایل واقعی وجود ندارد." }, { status: 404 });
  }

  const rows = await queryRows<ReceiptRow[]>(`
    SELECT pr.id,pr.file_path,pr.mime_type,p.user_id,r.buyer_user_id
    FROM payment_receipts pr
    JOIN payments p ON p.id=pr.payment_id
    JOIN registrations r ON r.id=p.registration_id
    WHERE pr.id=?
    LIMIT 1
  `, [id]);

  const receipt = rows[0];
  if (!receipt) return NextResponse.json({ message: "فیش یافت نشد." }, { status: 404 });

  const ownsReceipt = String(receipt.user_id || receipt.buyer_user_id || "") === auth.user.id;
  if (!ownsReceipt && !hasPermission(auth.user, "payments.view")) {
    return NextResponse.json({ message: "دسترسی غیرمجاز است." }, { status: 403 });
  }

  const storageRoot = path.resolve(process.cwd(), "storage");
  const filePath = path.resolve(storageRoot, receipt.file_path);
  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    return NextResponse.json({ message: "مسیر فایل نامعتبر است." }, { status: 400 });
  }

  try {
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": receipt.mime_type,
        "Content-Disposition": `inline; filename="receipt-${receipt.id}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ message: "فایل فیش روی سرور موجود نیست." }, { status: 404 });
  }
}
