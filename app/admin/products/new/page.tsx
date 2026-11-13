import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listActiveCategories, listBrands } from "@/lib/server/admin-data";
import { AdminSpinner, AdminEmptyState, AdminError } from "@/lib/server/admin-ui";
import { ProductForm } from "../[id]/edit/ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  // New products may only be filed onto an active category.
  const categories = await listActiveCategories(db);
  const brands = await listBrands(db, { page: 1, limit: 200 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/products" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to products
        </Link>
        <div className="admin-page-title">
          <h1>New product</h1>
          <p className="admin-page-subtitle">Add a product to the catalogue</p>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Product details</h2>
          </div>
          <ProductForm
            productId=""
            initial={{
              title: "",
              slug: "",
              categoryId: null,
              categoryLabel: null,
              brandId: null,
              shortDescription: "",
              description: [],
              priceCents: 0,
              compareAtPriceCents: null,
              badge: null,
              is_active: true,
              is_featured: false,
            }}
            categories={categories}
            brands={brands.rows}
          />
        </section>
      </div>
    </div>
  );
}
