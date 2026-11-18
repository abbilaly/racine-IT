import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getProductDetail, listCategories, listBrands } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import { AdminSpinner, AdminEmptyState, AdminError, AdminBadgeStatus, AdminTable, AdminPagination, AdminSearchInput } from "@/lib/server/admin-ui";
import { StockAdjustmentForm } from "./StockAdjustmentForm";
import { ProductForm } from "./ProductForm";
import { ProductImages } from "@/components/admin/products/ProductImages";
import Link from "next/link";
import { ArrowLeft, Package, Edit2, Trash2, Plus, History, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const product = await getProductDetail(db, id);
  if (!product) notFound();

  const categories = await listCategories(db);
  const brands = await listBrands(db, { page: 1, limit: 200 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/products" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to products
        </Link>
        <div className="admin-page-title">
          <h1>Edit product</h1>
          <p className="admin-page-subtitle">{product.title}</p>
        </div>
        <div className="admin-page-actions">
          <Link href={`/admin/products/${id}/images`} className="btn-outline">
            <Upload size={16} />
            Manage images
          </Link>
          <Link href={`/admin/products/${id}/stock`} className="btn-outline">
            <History size={16} />
            Stock history
          </Link>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Product details</h2>
          </div>
          <ProductForm
            productId={id}
            initial={{
              title: product.title,
              slug: product.slug,
              categoryId: product.category?.id,
              categoryLabel: product.category?.label,
              brandId: product.brand?.id ?? null,
              shortDescription: product.short_description,
              description: product.description ?? [],
              priceCents: product.price_cents,
              compareAtPriceCents: product.compare_at_price_cents,
              badge: product.badge,
              origin: product.origin,
              sourceUrl: product.source_url,
              is_active: product.is_active,
              is_featured: product.is_featured,
            }}
            categories={categories}
            brands={brands.rows}
          />
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Stock and inventory</h2>
            <Link href={`/admin/products/${id}/stock`} className="admin-card-link">
              View full history
            </Link>
          </div>
          <StockAdjustmentForm productId={id} />
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Product images</h2>
            <Link href={`/admin/products/${id}/images`} className="admin-card-link">
              Manage all images
            </Link>
          </div>
          <ProductImages productId={id} images={product.images} />
        </section>
      </div>
    </div>
  );
}
