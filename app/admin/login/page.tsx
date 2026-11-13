import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { getAdminSession } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

/**
 * `/admin/login`. An already-authenticated administrator is sent straight to the
 * dashboard; everyone else gets the shared sign-in form (the same one the admin
 * layout uses as its login wall).
 */
export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  return <AdminLoginForm />;
}
