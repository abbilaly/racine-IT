import { getAdminSession } from "@/lib/server/admin-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminBreadcrumbs } from "@/components/admin/nav";
import Link from "next/link";

export const metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    return (
      <div className="admin-page">
        <h1>Admin sign in required</h1>
        <p>Please sign in to view the admin dashboard.</p>
        <Link href="/admin/login" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Admin dashboard</h1>
      <p>Signed in as {session.email}</p>
      <p>Role: {session.role ?? "—"}</p>
      <AdminBreadcrumbs
        items={[
          { label: "Admin" },
        ]}
      />
    </div>
  );
}
