import { requireAdmin } from "@/lib/server/admin-auth";
import { getWebhookDiagnostics } from "@/lib/server/email-center";
import { AdminBreadcrumbs } from "@/components/admin/nav";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email webhooks" };

export default async function WebhooksPage() {
  await requireAdmin();
  const diagnostics = getWebhookDiagnostics();
  const ready = diagnostics.secret_configured && diagnostics.email_provider_configured;

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "Webhooks" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Webhooks</h1>
          <p className="admin-page-subtitle">
            Resend posts delivery, bounce, complaint, open and click events here. Only
            signed requests are accepted; duplicate events are ignored.
          </p>
        </div>
        <span className={`ec-status-pill${ready ? " ec-status-pill--ok" : " ec-status-pill--warn"}`}>
          {ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {ready ? "Configured" : "Setup incomplete"}
        </span>
      </header>

      <section className="ec-section">
        <div className="ec-section-head">
          <h2>Configuration</h2>
          <p>No secret or token value is ever displayed here.</p>
        </div>
        <div className="ec-kv ec-kv--compact">
          <div className="ec-kv-row">
            <span className="ec-kv-key">Endpoint</span>
            <span className="ec-kv-value">
              <code>/api/admin/webhooks/resend</code>
            </span>
          </div>
          <div className="ec-kv-row">
            <span className="ec-kv-key">Signature verification</span>
            <span className="ec-kv-value">
              {diagnostics.secret_configured ? "Enabled (Svix HMAC-SHA256)" : "Not configured"}
            </span>
          </div>
          <div className="ec-kv-row">
            <span className="ec-kv-key">Email provider key</span>
            <span className="ec-kv-value">
              {diagnostics.email_provider_configured ? "Configured" : "Not configured"}
            </span>
          </div>
          <div className="ec-kv-row">
            <span className="ec-kv-key">Registered URL</span>
            <span className="ec-kv-value">
              {diagnostics.webhook_url ?? "Not recorded"}
            </span>
          </div>
        </div>

        <details className="ec-details">
          <summary>Technical diagnostics</summary>
          <div className="ec-details-body">
            <ul className="ec-list">
              <li>
                <code>RESEND_WEBHOOK_SECRET</code>:{" "}
                {diagnostics.secret_configured ? "present" : "missing"}
              </li>
              <li>
                <code>RESEND_WEBHOOK_TEST_TOKEN</code>:{" "}
                {diagnostics.test_token_configured ? "present" : "missing"}
              </li>
              <li>Verification: HMAC-SHA256 over the signed timestamp and raw body, 5-minute tolerance.</li>
              <li>Deduplication: each provider event id is stored once before the log row is updated.</li>
              <li>Fallback match: provider message id, then recipient plus subject.</li>
            </ul>
            {diagnostics.note ? <p className="ec-metrics-hint">{diagnostics.note}</p> : null}
          </div>
        </details>
      </section>

      <section className="ec-section">
        <div className="ec-section-head">
          <h2>Event handling</h2>
        </div>
        <ul className="ec-list">
          <li>Delivered, bounced, complained, opened and clicked update the matching email log row.</li>
          <li>Events that match no local email are acknowledged and dropped, never invented.</li>
          <li>No admin browser session is needed: the provider authenticates with its signature.</li>
        </ul>
      </section>

      <section className="ec-section">
        <div className="ec-section-head">
          <h2>Setup still required</h2>
        </div>
        <ol className="ec-list">
          <li>
            Add the <code>RESEND_WEBHOOK_SECRET</code> Worker secret (Resend → Webhooks →
            signing secret).
          </li>
          <li>
            Register <code>/api/admin/webhooks/resend</code> in Resend for this Worker&apos;s
            domain and choose the events you want.
          </li>
          <li>Apply the email center migration so the event tables exist.</li>
        </ol>
      </section>
    </div>
  );
}
