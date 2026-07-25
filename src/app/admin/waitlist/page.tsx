import { AdminWaitlistManager } from "@/components/admin/waitlist-manager";import { requireAdminPage } from "@/lib/page-authorization";
export default async function AdminWaitlist(){await requireAdminPage('tournaments.manage');return <div><p className="section-kicker">WAITLIST OPERATIONS</p><h1 className="section-title mt-2">مدیریت صف انتظار</h1><AdminWaitlistManager/></div>}
