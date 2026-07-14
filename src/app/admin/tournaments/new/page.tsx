import { TournamentBuilder } from "@/components/admin/tournament-builder";

export default async function NewTournament({
  searchParams
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const templateId = template && /^\d+$/.test(template) ? Number(template) : undefined;

  return <div>
    <p className="section-kicker">CREATE TOURNAMENT</p>
    <h1 className="section-title mt-2">ساخت مسابقه جدید</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">از صفر شروع کنید یا تنظیمات یک قالب ذخیره‌شده را کپی و ویرایش کنید.</p>
    <div className="mt-8"><TournamentBuilder initialTemplateId={templateId} /></div>
  </div>;
}
