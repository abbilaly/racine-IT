import Link from "next/link";
import { Mail } from "lucide-react";
import { requireAdmin } from "@/lib/server/admin-auth";
import { SendTestEmailForm } from "@/components/admin/SendTestEmailForm";
import { AdminBreadcrumbs } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send test email" };

export default async function NewEmailTestPage() {
  await requireAdmin();

  const testRecipient = (process.env.EMAIL_TEST_RECIPIENT ?? "").trim();

  return (
    <div className="admin-page ec-page">
      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Send test email</h1>
          <p className="admin-page-subtitle">
            Sends one message through the configured Resend account. Test-only mode is
            always on: the server refuses any recipient other than the configured test
            address.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link href="/admin/emails/history" className="btn-outline">
            Email history
          </Link>
        </div>
      </header>

      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "History", href: "/admin/emails/history" },
          { label: "Send test email" },
        ]}
      />

      {testRecipient ? null : (
        <div className="admin-error" role="alert">
          <strong>No test recipient configured</strong>
          <p>
            Set the <code>EMAIL_TEST_RECIPIENT</code> Worker secret, then reload this page.
            The send endpoint rejects every recipient while it is missing.
          </p>
        </div>
      )}

      <SendTestEmailForm defaultRecipient={testRecipient} />
    </div>
  );
}
