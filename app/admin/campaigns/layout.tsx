import { redirect } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Email campaigns are part of the Email Center and log into `email_log` /
 * `email_events` (migration `0005_email_center.sql`). Hidden until that
 * migration is applied and verified.
 */
export default function CampaignsSectionLayout({ children }: { children: React.ReactNode }) {
  if (!EMAIL_CENTER_ENABLED) redirect("/admin");
  return <>{children}</>;
}
