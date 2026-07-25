import { SettingsManager } from "@/components/admin/settings-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function Settings() {
  await requireAdminPage("settings.manage");
  return <div><p className="section-kicker">APPLICATION SETTINGS</p><h1 className="section-title mt-2">تنظیمات سیستم</h1><SettingsManager/></div>;
}
