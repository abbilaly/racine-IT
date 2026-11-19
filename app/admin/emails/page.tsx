import Link from "next/link";
import { renderEmailCenterDisabled } from "@/lib/server/email-center-gate";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import {
  getEmailMetrics,
  getWebhookDiagnostics,
  listEmailLogs,
  type EmailLogRow,
  type EmailMetrics,
} from "@/lib/server/email-center";
import { EmailMetricsPanel } from "@/components/admin/EmailMetrics";
import { AdminBreadcrumbs } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email Center" };

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EmailOverviewPage() {
  const session = await requireAdmin();
  // Screens that need migration 0005 render an explicit disabled state.
  const emailCenterDisabled = renderEmailCenterDisabled();
  if (emailCenterDisabled) return emailCenterDisabled;
  const db = adminClient(session);

  let metrics: EmailMetrics | null = null;
  let metricsError: string | null = null;
  try {
    metrics = await getEmailMetrics(db, 90);
  } catch (error) {
    metricsError =
      error instanceof Error ? error.message : "Failed to load email metrics.";
  }

  let recent: EmailLogRow[] = [];
  try {
    const result = await listEmailLogs(db, { limit: 6 });
    recent = result.rows;
  } catch {
    recent = [];
  }

  const diagnostics = getWebhookDiagnostics();

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Email Center</h1>
          <p className="admin-page-subtitle">
            Delivery activity recorded in the email log over the last 90 days. Provider
            events only appear after a verified Resend webhook.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link href="/admin/emails/history/new" className="btn-dark">
            Send test email
          </Link>
        </div>
      </header>

      {metrics ? (
        <EmailMetricsPanel metrics={metrics} configured={diagnostics.email_provider_configured} />
      ) : (
        <div className="admin-error" role="alert">
          <strong>Email metrics unavailable</strong>
          <p>{metricsError ?? "The email log could not be read."}</p>
        </div>
      )}

      <section className="ec-section">
        <div className="ec-section-head">
          <h2>Recent email activity</h2>
          <Link href="/admin/emails/history" className="ec-link">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="ec-activity">
            <p className="ec-empty">
              No emails have been logged yet. Send a test email or trigger an order or
              quotation notification to populate this list.
            </p>
          </div>
        ) : (
          <div className="ec-activity">
            {recent.map(row => (
              <Link
                key={row.id}
                href={`/admin/emails/history/${row.id}`}
                className="ec-activity-row"
              >
                <span className="ec-activity-subject">{row.subject}</span>
                <span className="ec-activity-meta">
                  <span>{row.to_email}</span>
                  <span>{row.kind.replace(/_/g, " ")}</span>
                </span>
                <span className="ec-activity-side">
                  <span className={`admin-status admin-status--${row.status}`}>{row.status}</span>
                  <span>{formatWhen(row.created_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
