import { getAdminSession } from "@/lib/server/admin-auth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { EmailCenterNav } from "@/components/admin/EmailCenterNav";
import "./globals.css";
import "./email-center.css";
import "./admin-pages.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * SECURITY: this is a login wall, not just a chrome wrapper. When there is no
 * verified administrator session the layout renders the sign-in form *instead
 * of* `children`, so no admin page content can reach an anonymous visitor even
 * if a page were to miss its own `requireAdmin()` guard. Individual pages still
 * call `requireAdmin()` as defence in depth, and every data query runs under the
 * administrator's own token so RLS remains the real boundary.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    return <AdminLoginForm />;
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <EmailCenterNav />
        {children}
      </main>
    </div>
  );
}
