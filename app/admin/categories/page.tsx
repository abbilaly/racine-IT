import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listCategories } from "@/lib/server/admin-data";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const categories = await listCategories(db);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Categories</h1>
          <p className="admin-page-subtitle">
            Category slugs power storefront URLs — they cannot be renamed after creation
          </p>
        </div>
      </div>

      <CategoriesManager initial={categories} />
    </div>
  );
}