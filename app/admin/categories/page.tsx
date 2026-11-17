import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listCategories, categoryProductCounts } from "@/lib/server/admin-data";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { TablePageHeader } from "@/components/admin/tables/page-header";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const categories = await listCategories(db);
  const counts = await categoryProductCounts(db);
  const visible = categories.filter(category => category.is_active).length;

  return (
    <div className="admin-page admin-manager-page">
      <TablePageHeader
        title="Categories"
        subtitle={`${visible} visible · ${categories.length} total · slugs power storefront URLs and cannot be renamed`}
      />

      <CategoriesManager
        initial={categories}
        initialCounts={Object.fromEntries(counts)}
      />
    </div>
  );
}
