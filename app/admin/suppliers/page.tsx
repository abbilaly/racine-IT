import { requireAdmin } from "@/lib/server/admin-auth";
import { SuppliersManager } from "@/components/admin/SuppliersManager";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  await requireAdmin();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Suppliers</h1>
          <p className="admin-page-subtitle">
            Supplier profiles, purchase references and synchronization history
          </p>
        </div>
      </div>

      <SuppliersManager />
    </div>
  );
}