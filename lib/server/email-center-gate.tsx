import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Email Center availability.
 *
 * The Email Center, Follow-ups, Templates, Campaigns and Webhooks screens read
 * tables created by `supabase/migrations/0005_email_center.sql`. That migration
 * is deliberately not applied yet, so those screens are hidden from the admin
 * navigation — but hiding a link is not access control, and the routes were
 * still directly reachable and failed with raw "table not found" errors.
 *
 * This renders an explicit disabled screen instead of redirecting, so the state
 * is visible and cannot be defeated by a framework redirect being swallowed.
 * `lib/site-config.ts` is the single switch: set EMAIL_CENTER_ENABLED to true
 * only after 0005 is applied and verified.
 */
export function renderEmailCenterDisabled(): React.ReactNode | null {
  if (EMAIL_CENTER_ENABLED) return null;

  return (
    <div className="admin-page">
      <div className="admin-card" style={{ maxWidth: 720 }}>
        <div className="admin-card-header">
          <h2>Email Center is not enabled</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground, #6b6b76)" }}>
          Follow-ups, email templates, campaigns and webhook diagnostics depend on the tables
          created by{" "}
          <code style={{ fontSize: 12 }}>supabase/migrations/0005_email_center.sql</code>, which is
          not applied to this database yet. Until it is applied and verified, these screens stay
          switched off and no email is sent from them.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground, #6b6b76)" }}>
          Orders, customers, products, banners and store settings are unaffected and remain fully
          available.
        </p>
        <p style={{ margin: "14px 0 0" }}>
          <a href="/admin" style={{ fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>
            Back to the dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
