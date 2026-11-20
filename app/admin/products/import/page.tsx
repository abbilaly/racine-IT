import { requireAdmin } from "@/lib/server/admin-auth";
import { ImportView } from "@/components/admin/ImportView";
import { getStoreCurrency } from "@/lib/server/store-currency";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  await requireAdmin();
  const currency = await getStoreCurrency();
  return <ImportView currency={currency} />;
}