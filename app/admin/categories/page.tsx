import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listCategories, categoryProductCounts } from "@/lib/server/admin-data";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const categories = await listCategories(db);
  const counts = await categoryProductCounts(db);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Categories</h1>
          <p className="admin-page-subtitle">
            {categories.filter(category => category.is_active).length} visible ·{" "}
            {categories.length} total. Slugs power storefront URLs and cannot be renamed.
          </p>
        </div>
      </div>

      <CategoriesManager
        initial={categories}
        initialCounts={Object.fromEntries(counts)}
      />
    </div>
  );
}