import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSession, hasPermission } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";

const allowed = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"]
]);
const maxSize = 5 * 1024 * 1024;

type PaymentRow = RowDataPacket & {
  id: number;
  public_id: string;
  user_id: number | null;
  buyer_user_id: number | null;
  registration_id: number;
  qr_token: string;
  status: string;
  old_file_path: string | null;
  method: string;
  payer_name: string | null;
  payer_card_last4: string | null;
  tracking_code: string | null;
  paid_on: string | Date | null;
};

function matchesSignature(buffer: Buffer, mime: string) {
  if (mime === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
}

export async function POST(request: Request) {
  const user = await getSession();

  try {
    const form = await request.formData();
    const file = form.get("file");
    const paymentId = String(form.get("paymentId") || "").trim();
    const receiptToken = String(form.get("receiptToken") || "").trim();

    if (!(file instanceof File) || !paymentId) {
      return NextResponse.json({ message: "شناسه پرداخت و فایل فیش الزامی است." }, { status: 422 });
    }

    const extension = allowed.get(file.type);
    if (!extension || file.size <= 0 || file.size > maxSize) {
      return NextResponse.json({ message: "فقط JPG، PNG یا PDF تا ۵ مگابایت مجاز است." }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesSignature(buffer, file.type)) {
      return NextResponse.json({ message: "محتوای واقعی فایل با نوع اعلام‌شده مطابقت ندارد." }, { status: 422 });
    }

    const payments = await queryRows<PaymentRow[]>(`
      SELECT p.id,p.public_id,p.user_id,p.registration_id,p.status,p.method,
             p.payer_name,p.payer_card_last4,p.tracking_code,p.paid_on,
             r.buyer_user_id,r.qr_token,pr.file_path AS old_file_path
      FROM payments p
      JOIN registrations r ON r.id=p.registration_id
      LEFT JOIN payment_receipts pr ON pr.payment_id=p.id
      WHERE (p.public_id=? OR p.id=?)
      LIMIT 1
    `, [paymentId, /^\d+$/.test(paymentId) ? Number(paymentId) : 0]);

    const payment = payments[0];
    if (!payment) return NextResponse.json({ message: "پرداخت یافت نشد." }, { status: 404 });

    const ownsPayment = Boolean(user && String(payment.user_id || payment.buyer_user_id || "") === user.id);
    const hasReceiptToken = Boolean(receiptToken && receiptToken === payment.qr_token);
    if (!ownsPayment && !hasReceiptToken && !hasPermission(user, "payments.approve")) {
      return NextResponse.json({ message: "اجازه بارگذاری فیش برای این پرداخت را ندارید." }, { status: 403 });
    }

    if (["APPROVED", "REFUNDED", "CANCELLED"].includes(payment.status)) {
      return NextResponse.json({ message: "وضعیت این پرداخت اجازه بارگذاری فیش جدید را نمی‌دهد." }, { status: 409 });
    }

    if (!["card_to_card", "receipt"].includes(payment.method)) {
      return NextResponse.json({ message: "تصویر رسید فقط برای انتقال بانکی قابل ثبت است." }, { status: 409 });
    }

    const fileName = `${payment.id}-${randomUUID()}.${extension}`;
    const relativePath = path.posix.join("receipts", fileName);
    const storageDirectory = path.join(process.cwd(), "storage", "receipts");
    const absolutePath = path.join(storageDirectory, fileName);
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(absolutePath, buffer, { flag: "wx" });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`
        INSERT INTO payment_receipts(payment_id,file_path,mime_type,file_size,uploaded_at)
        VALUES(?,?,?,?,NOW())
        ON DUPLICATE KEY UPDATE
          file_path=VALUES(file_path),mime_type=VALUES(mime_type),
          file_size=VALUES(file_size),uploaded_at=NOW()
      `, [payment.id, relativePath, file.type, file.size]);
      const hasPaymentDetails = Boolean(
        payment.payer_name && payment.payer_card_last4 && payment.tracking_code && payment.paid_on
      );
      await connection.execute(`
        UPDATE payments
        SET status=IF(?,'PENDING',status),
            rejected_reason=IF(?,NULL,rejected_reason),
            updated_at=NOW()
        WHERE id=?
      `, [hasPaymentDetails ? 1 : 0, hasPaymentDetails ? 1 : 0, payment.id]);
      if (hasPaymentDetails) {
        await connection.execute(`
          UPDATE registrations SET status='PENDING_APPROVAL',updated_at=NOW()
          WHERE id=? AND status NOT IN ('CANCELLED','REJECTED','WAITLISTED')
        `, [payment.registration_id]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }

    if (payment.old_file_path && payment.old_file_path !== relativePath) {
      const oldAbsolutePath = path.join(process.cwd(), "storage", payment.old_file_path);
      await unlink(oldAbsolutePath).catch(() => undefined);
    }

    await writeAuditLog({
      actorUserId: user?.id || null,
      action: "payment.receipt_uploaded",
      entityType: "payment",
      entityId: payment.id,
      newData: { filePath: relativePath, mimeType: file.type, fileSize: file.size, optional: true },
      request
    });

    return NextResponse.json({ ok: true, paymentId: payment.public_id }, { status: 201 });
  } catch (error) {
    console.error("payment.receipt.upload.failed", error);
    return NextResponse.json({ message: "آپلود فیش انجام نشد." }, { status: 500 });
  }
}
