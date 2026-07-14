import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";

const allowedSlugs = ["home", "rules", "about", "contact"] as const;
const querySchema = z.enum(allowedSlugs);
const saveSchema = z.object({
  slug: querySchema,
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(100000),
  seoTitle: z.string().trim().max(190).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  isPublished: z.boolean()
});

type ContentRow = RowDataPacket & {
  slug: string;
  title: string;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: number;
};

export async function GET(request: Request) {
  const auth = await authorize("content.manage");
  if (auth.response) return auth.response;

  try {
    const slug = querySchema.parse(new URL(request.url).searchParams.get("slug"));
    const rows = await queryRows<ContentRow[]>(`
      SELECT slug,title,body,seo_title,seo_description,is_published
      FROM page_contents WHERE slug=? LIMIT 1
    `, [slug]);
    const item = rows[0];
    if (!item) return NextResponse.json({ message: "محتوای صفحه یافت نشد." }, { status: 404 });

    return NextResponse.json({
      item: {
        slug: item.slug,
        title: item.title,
        body: item.body,
        seoTitle: item.seo_title || "",
        seoDescription: item.seo_description || "",
        isPublished: Boolean(item.is_published)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "صفحه انتخاب‌شده معتبر نیست." }, { status: 422 });
    }
    return NextResponse.json({ message: "دریافت محتوا انجام نشد." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await authorize("content.manage");
  if (auth.response) return auth.response;

  try {
    const input = saveSchema.parse(await request.json());
    const oldRows = await queryRows<ContentRow[]>(`SELECT * FROM page_contents WHERE slug=? LIMIT 1`, [input.slug]);
    await execute(`
      INSERT INTO page_contents(slug,title,body,seo_title,seo_description,is_published,updated_at)
      VALUES(?,?,?,?,?,?,NOW())
      ON DUPLICATE KEY UPDATE title=VALUES(title),body=VALUES(body),
        seo_title=VALUES(seo_title),seo_description=VALUES(seo_description),
        is_published=VALUES(is_published),updated_at=NOW()
    `, [
      input.slug,
      input.title,
      input.body,
      input.seoTitle || null,
      input.seoDescription || null,
      input.isPublished ? 1 : 0
    ]);
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "content.updated",
      entityType: "page_content",
      entityId: input.slug,
      oldData: oldRows[0] || null,
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, item: input });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "محتوای واردشده معتبر نیست.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "ذخیره محتوا انجام نشد." }, { status: 500 });
  }
}
