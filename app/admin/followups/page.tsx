import { requireAdmin } from "@/lib/server/admin-auth";
import { FollowupsClient } from "@/components/admin/FollowupsClient";
import { AdminBreadcrumbs } from "@/components/admin/nav";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups" };

export default async function FollowupsPage() {
  await requireAdmin();

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "Follow-ups" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Follow-up rules</h1>
          <p className="admin-page-subtitle">
            Reminder rules for quotations and pending orders. A rule never sends while it
            is a draft or paused, and sending always requires an active rule plus a
            scheduled job processed by the Cloudflare cron trigger.
          </p>
        </div>
      </header>

      <FollowupsClient />
    </div>
  );
}
