import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listBrands } from "@/lib/server/admin-data";
import { BrandsManager } from "@/components/admin/BrandsManager";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const { rows: brands } = await listBrands(db, { page: 1, limit: 200 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Brands</h1>
          <p className="admin-page-subtitle">Manage the brands assigned to your products</p>
        </div>
      </div>

      <BrandsManager initial={brands} />
    </div>
  );
}