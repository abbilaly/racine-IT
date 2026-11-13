import { redirect } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

/**
 * Email templates are part of the Email Center, which depends on migration
 * `0005_email_center.sql`. Hidden until that migration is applied and verified.
 */
export default function TemplatesSectionLayout({ children }: { children: React.ReactNode }) {
  if (!EMAIL_CENTER_ENABLED) redirect("/admin");
  return <>{children}</>;
}
