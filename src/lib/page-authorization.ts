import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";

export async function requireAdminPage(permission?: string) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/account");
  if (permission && !hasPermission(user, permission)) redirect("/admin?forbidden=1");
  return user;
}
