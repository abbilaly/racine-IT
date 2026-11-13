import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getProductDetail, listCategories, listBrands } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import { AdminSpinner, AdminEmptyState, AdminError, AdminBadgeStatus, AdminTable, AdminPagination, AdminSearchInput } from "@/lib/server/admin-ui";
import { ProductImages } from "../edit/ProductImages";
import Link from "next/link";
import { ArrowLeft, Package, Edit2, Trash2, Plus, History, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductImagesPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const db = adminClient(session);

  const product = await getProductDetail(db, params.id);
  if (!product) notFound();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/products" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to products
        </Link>
        <div className="admin-page-title">
          <h1>Manage images</h1>
          <p className="admin-page-subtitle">{product.title}</p>
        </div>
        <Link href={`/admin/products/${params.id}/edit`} className="btn-dark">
          <Edit2 size={16} />
          Edit product
        </Link>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Product images</h2>
            <p className="admin-card-subtitle">Primary image is shown on the storefront.</p>
          </div>
          <ProductImages productId={params.id} images={product.images} />
        </section>
      </div>
    </div>
  );
}
