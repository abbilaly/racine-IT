import { getAdminSession } from "@/lib/server/admin-auth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { EmailCenterNav } from "@/components/admin/EmailCenterNav";
import { AdminThemeProvider } from "@/components/admin/theme/theme-provider";
import { AdminShell } from "@/components/admin/shell/admin-shell";
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
    <AdminThemeProvider>
      <AdminShell email={session.email} role={session.role}>
        <EmailCenterNav />
        {children}
      </AdminShell>
    </AdminThemeProvider>
  );
}
