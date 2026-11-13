import { requireAdmin } from "@/lib/server/admin-auth";
import { ImportView } from "@/components/admin/ImportView";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  await requireAdmin();
  return <ImportView />;
}