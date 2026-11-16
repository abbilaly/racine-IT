import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listBrands, listCategories } from "@/lib/server/admin-data";
import { BrandsManager } from "@/components/admin/BrandsManager";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const { rows: brands } = await listBrands(db, { page: 1, limit: 200 });
  const categories = await listCategories(db);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Brands</h1>
          <p className="admin-page-subtitle">
            Logos, display order and the categories each brand is represented in
          </p>
        </div>
      </div>

      <BrandsManager
        initial={brands}
        categories={categories.map(category => ({
          id: category.id,
          label: category.label,
          parent_id: category.parent_id,
          is_active: category.is_active
        }))}
      />
    </div>
  );
}