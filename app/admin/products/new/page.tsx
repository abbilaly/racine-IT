import ProductForm from "@/components/admin/ProductForm";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { data } = await db.from("categories").select("slug,label").order("position");
  const categories = (data ?? []).map(row => ({ key: row.slug, label: row.label }));

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Add product</h1>
          <p>Creates a product, its stock line and its primary image</p>
        </div>
      </div>
      <ProductForm categories={categories} />
    </div>
  );
}
