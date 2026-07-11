import { MatchesManager } from "@/components/admin/matches-manager";

export default function Matches() {
  return <div>
    <p className="section-kicker">MATCH OPERATIONS</p>
    <h1 className="section-title mt-2">بازی‌ها و ثبت نتایج</h1>
    <MatchesManager/>
  </div>;
}
