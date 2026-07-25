import { ParticipantsManager } from "@/components/admin/participants-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function Participants() {
  await requireAdminPage("checkin.manage");
  return <div>
    <p className="section-kicker">PARTICIPANTS</p>
    <h1 className="section-title mt-2">شرکت‌کنندگان و Check-in</h1>
    <ParticipantsManager/>
  </div>;
}
