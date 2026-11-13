import { redirect } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Email Center pages read tables created by migration
 * `0005_email_center.sql` (email_events, followup_rules, followup_jobs,
 * email_suppressions). That migration is intentionally not applied yet, so the
 * whole section redirects back to the dashboard instead of rendering queries
 * against missing relations.
 *
 * Re-enable by applying 0005 and flipping EMAIL_CENTER_ENABLED in
 * `lib/site-config.ts`.
 */
export default function EmailCenterSectionLayout({ children }: { children: React.ReactNode }) {
  if (!EMAIL_CENTER_ENABLED) redirect("/admin");
  return <>{children}</>;
}
