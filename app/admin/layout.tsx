import Link from "next/link";
import { getAdminSession } from "@/lib/server/admin-auth";

export const metadata = {
  title: "Admin — Racine IT",
  robots: { index: false, follow: false }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  // Signed out: render the sign-in page without the admin chrome.
  if (!session) return <>{children}</>;

  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="admin-bar-inner">
          <Link href="/admin" className="admin-brand">Racine IT <span>admin</span></Link>
          <nav aria-label="Admin sections">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/products">Products</Link>
            <Link href="/admin/orders">Orders</Link>
            <Link href="/admin/settings">Settings</Link>
          </nav>
          <div className="admin-account">
            <span title={session.email}>{session.role}</span>
            <form action="/api/admin/logout" method="post">
              <button type="submit" className="btn-outline">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
