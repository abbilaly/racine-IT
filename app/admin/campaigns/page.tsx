import { requireAdmin } from "@/lib/server/admin-auth";
import { renderEmailCenterDisabled } from "@/lib/server/email-center-gate";
import { CampaignsClient } from "@/components/admin/CampaignsClient";
import { AdminBreadcrumbs } from "@/components/admin/nav";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requireAdmin();
  // Screens that need migration 0005 render an explicit disabled state.
  const emailCenterDisabled = renderEmailCenterDisabled();
  if (emailCenterDisabled) return emailCenterDisabled;

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "Campaigns" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Campaigns</h1>
          <p className="admin-page-subtitle">
            Campaign drafts are test-only for now: a send can only reach the single test
            recipient the server allows. Bulk sending to customers is not enabled.
          </p>
        </div>
      </header>

      <CampaignsClient />
    </div>
  );
}
