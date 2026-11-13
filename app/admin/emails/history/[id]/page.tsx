import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getEmailLog } from "@/lib/server/email-center";
import {
  emailConfigSummary,
  firstEmailDeliverySender,
} from "@/lib/server/email-config";
import { AdminBreadcrumbs } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email" };

export default async function EmailDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { id } = await params;
  const log = await getEmailLog(db, id);
  if (!log) notFound();

  const config = emailConfigSummary();
  const sender = firstEmailDeliverySender();

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

  const message = log;
  const record = {
    id: message.id,
    kind: message.kind,
    to_email: message.to_email,
    subject: message.subject,
    provider_message_id: message.provider_message_id,
    status: message.status,
    error: message.error,
    created_at: message.created_at,
    sent_at: message.sent_at,
    provider: message.provider,
    body: typeof message.body_preview === "string" ? message.body_preview.slice(0, 500) : "",
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Email</h1>
          <p className="admin-page-subtitle">Message {log.provider_message_id || "not yet sent"}</p>
        </div>
        <div className="admin-page-actions">
          <Link href="/admin/emails/history" className="btn-outline">
            Back to history
          </Link>
        </div>
      </div>

      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "History", href: "/admin/emails/history" },
          { label: "Message" },
        ]}
      />

      <div className="admin-grid">
        {/* message record */}
        <section className="admin-card admin-card--wide email-detail">
          <dl className="email-detail-dl">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`admin-badge admin-badge--${
                  log.status === "delivered" || log.status === "sent" || log.status === "active" || log.status === "accepted"
                    ? "success"
                    : log.status === "processing" || log.status === "pending"
                    ? "warning"
                    : log.status === "cancelled" || log.status === "rejected" || log.status === "failed" || log.status === "bounced"
                    ? "danger"
                    : "default"
                }`}>{log.status}</span>
              </dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd className="email-detail-mono">{log.kind.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd>{record.to_email}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd className="email-detail-mono">{record.subject}</dd>
            </div>
            <div>
              <dt>Provider message id</dt>
              <dd className="email-detail-mono">{record.provider_message_id ?? "—"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd className="email-detail-mono">{formatWhen(record.created_at)}</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd className="email-detail-mono">{record.sent_at ? formatWhen(record.sent_at) : "—"}</dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd className={record.error ? "email-detail-error" : undefined}>{record.error ?? "—"}</dd>
            </div>
          </dl>

          <details className="ec-details" style={{ marginTop: 14 }}>
            <summary>Raw message record</summary>
            <div className="ec-details-body">
              <pre className="studio-code" style={{ maxHeight: 240 }}>
{JSON.stringify({
                  id: record.id,
                  kind: record.kind,
                  to_email: record.to_email,
                  subject: record.subject,
                  provider_message_id: record.provider_message_id,
                  status: record.status,
                  error: record.error,
                  created_at: record.created_at,
                  sent_at: record.sent_at,
                  provider: record.provider,
                  body_preview:
                    record.body !== "" ? record.body : undefined,
                },
                null,
                2)}
</pre>
            </div>
          </details>
        </section>

        {/* config diagnostics */}
        <section className="admin-card email-detail" aria-labelledby="ec-config-heading" style={{ gridColumn: "1 / -1" }}>
          <h2 id="ec-config-heading">Email configuration</h2>
          <p className="admin-assistive-text" style={{ margin: "0 0 14px" }}>
            Status of the environment this Worker reads at runtime. No secret values are
            shown; only names, presence, and derived states.
          </p>

          <div className="admin-grid email-config-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {/* provider */}
            <div className="admin-config-field">
              <h3 className="admin-config-field-title">Email provider</h3>
              <ul className="admin-config-list">
                <li>Resend configured: <strong>{config.emailProviderConfigured ? "Set" : "Not set"}</strong></li>
                <li>Current sender: <strong>{sender}</strong></li>
                <li>
                  RESEND_FROM_EMAIL:
                  <strong style={{ marginLeft: 8 }}>
                    {config.fromAddress.configured ? "Set" : "Not set"}
                  </strong>
                </li>
                <li>
                  EMAIL_CONTACT_ADDRESS:
                  <strong style={{ marginLeft: 8 }}>
                    {config.contactAddress.present ? "Set" : "Not set"}
                    {!config.contactAddress.present ? " (missing)" : ""}
                    {config.contactAddress.validFormat === false ? " — invalid format" : ""}
                  </strong>
                </li>
              </ul>
            </div>

            {/* test mode */}
            <div className="admin-config-field">
              <h3 className="admin-config-field-title">Test mode</h3>
              <ul className="admin-config-list">
                <li>Test mode enforced: <strong>Yes</strong> (real recipients rejected)</li>
                <li>Test recipient set: <strong>{config.testMode.recipientConfigured ? "Set" : "Not set"}</strong></li>
                <li>
                  EMAIL_TEST_RECIPIENT:
                  <strong className="admin-config-value-mono" style={{ marginLeft: 8 }}>
                    {config.testMode.recipientValue ?? "—"}
                  </strong>
                </li>
              </ul>
            </div>

            {/* webhook */}
            <div className="admin-config-field">
              <h3 className="admin-config-field-title">Webhook</h3>
              <ul className="admin-config-list">
                <li>Webhook URL: <strong className="admin-config-value-mono">{config.webhook.url ?? "Not set"}</strong></li>
                <li>Webhook secret: <strong>{config.webhook.secretEnabled ? "Set" : "Not set"}</strong></li>
                <li>Webhook test token: <strong>{config.webhook.testTokenEnabled ? "Set" : "Not set"}</strong></li>
              </ul>
            </div>
          </div>

          {config.note ? (
            <div className="admin-notice" role="status">
              <strong>Note:</strong> {config.note}
            </div>
          ) : null}

          <details className="ec-details" style={{ marginTop: 8 }}>
            <summary>Environment variables this module reads</summary>
            <div className="ec-details-body" style={{ padding: 8 }}>
              <p className="admin-assistive-text" style={{ margin: 0 }}>
                These names are reported only as keys. Their values are never sent to the
                browser and never included in this response.
              </p>
              <code className="admin-config-value-mono" style={{ display: "block", marginTop: 6 }}>
                {config.expectedVariables.join(", ")}
              </code>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
