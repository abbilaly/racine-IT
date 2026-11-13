import { redirect } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Follow-up automation is part of the Email Center and depends on
 * `followup_rules` / `followup_jobs` from migration `0005_email_center.sql`.
 * Hidden until that migration is applied and verified.
 */
export default function FollowupsSectionLayout({ children }: { children: React.ReactNode }) {
  if (!EMAIL_CENTER_ENABLED) redirect("/admin");
  return <>{children}</>;
}
