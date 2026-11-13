import type { EmailLogRow } from "@/lib/server/email-center";
import Link from "next/link";

export interface EmailDetailProps {
  row: EmailLogRow;
  backHref?: string;
}

const KIND_LABELS: Record<string, string> = {
  order_confirmation: "Order confirmation",
  order_status: "Order status",
  quotation: "Quotation",
  admin_notification: "Admin notification",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
  failed: "Failed",
};

export function EmailDetail({ row, backHref = "/admin/emails/history" }: EmailDetailProps) {
  return (
    <div className="email-detail">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link href={backHref} className="admin-link">
          Email history
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{row.subject}</span>
      </nav>

      <h1>{row.subject}</h1>

      <dl className="email-detail-dl">
        <dt>Recipient</dt>
        <dd className="email-detail-addr">{row.to_email}</dd>

        <dt>Type</dt>
        <dd>
          <span className="admin-badge">{KIND_LABELS[row.kind] ?? row.kind}</span>
        </dd>

        <dt>Status</dt>
        <dd>
          <span className={`admin-status admin-status--${row.status}`}>
            {STATUS_LABELS[row.status] ?? row.status}
          </span>
        </dd>

        <dt>Provider</dt>
        <dd>{row.provider}</dd>

        <dt>Provider message ID</dt>
        <dd>
          {row.provider_message_id ? (
            <code className="email-detail-mono">{row.provider_message_id}</code>
          ) : (
            "—"
          )}
        </dd>

        <dt>Created</dt>
        <dd>{new Date(row.created_at).toLocaleString()}</dd>

        {row.sent_at && (
          <>
            <dt>Sent</dt>
            <dd>{new Date(row.sent_at).toLocaleString()}</dd>
          </>
        )}

        {row.error && (
          <>
            <dt>Error</dt>
            <dd className="email-detail-error">{row.error}</dd>
          </>
        )}
      </dl>

      {row.body_preview ? (
        <div className="email-detail-body">
          <h2>Body preview</h2>
          <pre>{row.body_preview}</pre>
        </div>
      ) : null}
    </div>
  );
}
