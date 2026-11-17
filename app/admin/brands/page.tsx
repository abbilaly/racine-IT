import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listBrands, listCategories } from "@/lib/server/admin-data";
import { BrandsManager } from "@/components/admin/BrandsManager";
import { TablePageHeader } from "@/components/admin/tables/page-header";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const { rows: brands } = await listBrands(db, { page: 1, limit: 200 });
  const categories = await listCategories(db);

  return (
    <div className="admin-page admin-manager-page">
      <TablePageHeader
        title="Brands"
        subtitle={`${brands.length.toLocaleString()} brand${brands.length === 1 ? "" : "s"} · logos, display order and category coverage`}
      />

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
