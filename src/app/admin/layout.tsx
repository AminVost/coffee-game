import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getSession } from "@/lib/auth";
import { getPendingPaymentCount } from "@/lib/repositories/admin-dashboard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user || user.role !== "admin") redirect("/login");
  const pendingPaymentCount = await getPendingPaymentCount();

  return <div className="admin-grid">
    <AdminSidebar
      permissions={user.permissions}
      pendingPaymentCount={pendingPaymentCount}
    />
    <div className="min-w-0">
      <AdminHeader user={user}/>
      <main className="p-4 sm:p-7">{children}</main>
    </div>
  </div>;
}
