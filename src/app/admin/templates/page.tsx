import { Copy } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

export const dynamic = "force-dynamic";

type TemplateRow = RowDataPacket & {
  id: number;
  title: string;
  description: string | null;
  game_title: string;
  configuration: unknown;
  updated_at: Date;
};

function configurationSummary(value: unknown) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (typeof value === "string" ? JSON.parse(value) : value) as Record<string, unknown> || {};
  } catch {
    parsed = {};
  }

  return {
    format: typeof parsed.format === "string" ? parsed.format : "ثبت نشده",
    capacity: typeof parsed.capacity === "number" ? parsed.capacity : Number(parsed.capacity || 0)
  };
}

export default async function Templates() {
  const templates = await queryRows<TemplateRow[]>(`
    SELECT tt.id,tt.title,tt.description,tt.configuration,tt.updated_at,g.title AS game_title
    FROM tournament_templates tt
    JOIN games g ON g.id=tt.game_id
    WHERE tt.is_active=1
    ORDER BY tt.updated_at DESC,tt.id DESC
  `);

  return <div>
    <div>
      <p className="section-kicker">SAVED CONFIGURATIONS</p>
      <h1 className="section-title mt-2">قالب‌های مسابقه</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">قالب‌های ذخیره‌شده مستقیماً از دیتابیس نمایش داده می‌شوند.</p>
    </div>
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const summary = configurationSummary(template.configuration);
        return <Card key={template.id} className="p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)]/12 text-[var(--brand)]"><Copy /></span>
          <h2 className="mt-5 text-lg font-black">{template.title}</h2>
          {template.description && <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{template.description}</p>}
          <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            <span>بازی: {template.game_title}</span>
            <span>فرمت: {summary.format}</span>
            <span>ظرفیت پیش‌فرض: {summary.capacity > 0 ? summary.capacity.toLocaleString("fa-IR") : "ثبت نشده"}</span>
          </div>
          <div className="mt-6">
            <Button href={`/admin/tournaments/new?template=${template.id}`} size="sm">استفاده از قالب</Button>
          </div>
        </Card>;
      })}
    </div>
    {!templates.length && <Card className="mt-7 p-10 text-center text-[var(--muted)]">قالب فعالی در دیتابیس وجود ندارد.</Card>}
  </div>;
}
