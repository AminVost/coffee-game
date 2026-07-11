import { TeamsManager } from "@/components/account/teams-manager";

export default function Teams() {
  return <div>
    <p className="section-kicker">MY TEAMS</p>
    <h1 className="section-title mt-2">تیم‌های من</h1>
    <TeamsManager/>
  </div>;
}
