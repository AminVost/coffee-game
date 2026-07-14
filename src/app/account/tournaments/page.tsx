import { CalendarDays, CreditCard, Link2, MapPin, Users } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import {
  paymentStatusTitle,
  registrationStatusTitle
} from "@/lib/registration-flow";
import { formatToman } from "@/lib/utils";

type RegistrationItem = {
  id: number;
  tournament_title: string;
  tournament_slug: string;
  starts_at: Date;
  venue_title: string | null;
  registration_status: string;
  slots: number;
  payable_amount: number;
  tracking_token: string | null;
  tracking_code: string | null;
  payment_status: string | null;
  payment_method: string | null;
  created_at: Date;
};

type RegistrationRow = RowDataPacket & RegistrationItem;

export default async function MyTournaments() {
  const user = await getSession();

  const rows = await queryRows<RegistrationRow[]>(`
    SELECT
      r.id,
      t.title AS tournament_title,
      t.slug AS tournament_slug,
      t.starts_at,
      v.title AS venue_title,
      r.status AS registration_status,
      r.slots,
      r.payable_amount,
      r.tracking_token,
      r.tracking_code,
      p.status AS payment_status,
      p.method AS payment_method,
      r.created_at
    FROM registrations r
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN venues v ON v.id=t.venue_id
    LEFT JOIN payments p ON p.registration_id=r.id
    WHERE r.buyer_user_id=?
      AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC,r.id DESC
  `, [user?.id || 0]);

  return (
    <div>
      <p className="section-kicker">MY TOURNAMENTS</p>
      <h1 className="section-title mt-2">مسابقات من</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        ثبت‌نام‌هایی که با شماره موبایل این حساب انجام شده‌اند.
      </p>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {rows.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-black">{item.tournament_title}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]" dir="ltr">
                  {item.tracking_code || "—"}
                </p>
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold">
                {registrationStatusTitle(item.registration_status)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info
                icon={<CalendarDays size={16} />}
                title="زمان مسابقه"
                value={new Intl.DateTimeFormat("fa-IR", {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(item.starts_at))}
              />
              <Info
                icon={<MapPin size={16} />}
                title="محل"
                value={item.venue_title || "متعاقباً اعلام می‌شود"}
              />
              <Info
                icon={<Users size={16} />}
                title="تعداد ظرفیت"
                value={Number(item.slots).toLocaleString("fa-IR")}
              />
              <Info
                icon={<CreditCard size={16} />}
                title="وضعیت پرداخت"
                value={item.payment_status
                  ? paymentStatusTitle(item.payment_status, item.payment_method || undefined)
                  : "پرداختی ثبت نشده"}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <strong className="text-[var(--brand)]">{formatToman(Number(item.payable_amount))}</strong>
              <div className="flex flex-wrap gap-2">
                <Button href={`/tournaments/${item.tournament_slug}`} variant="secondary" size="sm">
                  صفحه مسابقه
                </Button>
                {item.tracking_token && (
                  <Button href={`/track/${item.tracking_token}`} variant="soft" size="sm">
                    <Link2 size={15} />
                    پیگیری ثبت‌نام
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {!rows.length && (
          <Card className="p-10 text-center text-[var(--muted)]">
            هنوز ثبت‌نامی به این حساب متصل نشده است.
          </Card>
        )}
      </div>
    </div>
  );
}

function Info({
  icon,
  title,
  value
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
      <span className="text-[var(--brand)]">{icon}</span>
      <div>
        <p className="text-[11px] text-[var(--muted)]">{title}</p>
        <strong className="mt-1 block text-sm">{value}</strong>
      </div>
    </div>
  );
}
