import { MatchesManager } from "@/components/admin/matches-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function Matches() {
  await requireAdminPage("results.submit");
  return <div>
    <p className="section-kicker">MATCH OPERATIONS</p>
    <h1 className="section-title mt-2">بازی‌ها و ثبت نتایج</h1>
    <MatchesManager/>
  </div>;
}
