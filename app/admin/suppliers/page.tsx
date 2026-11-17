import { requireAdmin } from "@/lib/server/admin-auth";
import { SuppliersManager } from "@/components/admin/SuppliersManager";
import { TablePageHeader } from "@/components/admin/tables/page-header";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  await requireAdmin();

  return (
    <div className="admin-page admin-manager-page">
      <TablePageHeader
        title="Suppliers"
        subtitle="Supplier profiles, purchase references and synchronization history"
      />

      <SuppliersManager />
    </div>
  );
}
