import { redirect } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Webhook diagnostics belong to the Email Center and read `email_events`
 * (migration `0005_email_center.sql`). The inbound Resend webhook route under
 * `app/api/admin/webhooks/resend` stays available (it verifies its own
 * signature and no-ops safely), but this admin screen is hidden until 0005 is
 * applied and verified.
 */
export default function WebhooksSectionLayout({ children }: { children: React.ReactNode }) {
  if (!EMAIL_CENTER_ENABLED) redirect("/admin");
  return <>{children}</>;
}
