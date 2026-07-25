import { AdminDisputesManager } from "@/components/admin/disputes-manager";import { requireAdminPage } from "@/lib/page-authorization";
export default async function AdminDisputes(){await requireAdminPage('matches.manage');return <div><p className="section-kicker">DISPUTES</p><h1 className="section-title mt-2">اعتراض به نتایج</h1><AdminDisputesManager/></div>}
