import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getProductDetail, listStockAdjustments, formatCents } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AdminSpinner, AdminEmptyState, AdminBadgeStatus, AdminTable, AdminPagination, AdminSearchInput } from "@/lib/server/admin-ui";
import Link from "next/link";
import { ArrowLeft, Package, ArrowUpDown, Edit2, Trash2, Plus, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const product = await getProductDetail(db, id);
  if (!product) notFound();

  const stockHistory = await listStockAdjustments(db, id, { page: 1, limit: 20 });

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
          <Link href={`/admin/products/${id}/edit`} className="btn-dark">
            <Edit2 size={16} />
            Edit product
          </Link>
          <Link href={`/admin/products/${id}/images`} className="btn-outline">
            <Package size={16} />
            Manage images
          </Link>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Current stock</h2>
            <Link href={`/admin/products/${id}/stock`} className="admin-card-link">
              View full history
            </Link>
          </div>
          <div className="admin-stock-summary">
            <div className="admin-stock-value">
              <Package size={24} />
              <span>{product.stock.toLocaleString()}</span>
              <span className="admin-stock-label">units on hand</span>
            </div>
            {product.stock === 0 && (
              <div className="admin-stock-alert">
                <span className="admin-badge admin-badge--danger">Out of stock</span>
              </div>
            )}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Pricing</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt>Selling price</dt>
              <dd>${formatCents(product.price_cents)}</dd>
            </div>
            {product.compare_at_price_cents != null && (
              <div className="admin-definition-row">
                <dt>Compare-at price</dt>
                <dd>${formatCents(product.compare_at_price_cents)}</dd>
              </div>
            )}
            {product.badge && (
              <div className="admin-definition-row">
                <dt>Badge</dt>
                <dd><AdminBadgeStatus status={product.badge} /></dd>
              </div>
            )}
          </dl>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Stock movement history</h2>
            <Link href={`/admin/products/${id}/stock`} className="admin-card-link">
              View all
            </Link>
          </div>
          {stockHistory.rows.length === 0 ? (
            <AdminEmptyState title="No stock adjustments yet" description="Adjustments you make through the product page will appear here." />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Change</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {stockHistory.rows.slice(0, 20).map(row => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`admin-stock-change ${row.change > 0 ? "positive" : "negative"}`}>
                          {row.change > 0 ? "+" : ""}
                          {row.change}
                        </span>
                      </td>
                      <td>{row.reason}</td>
                      <td className="admin-muted">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Details</h2>
          </div>
          <dl className="admin-definition-list admin-definition-list--stacked">
            <div className="admin-definition-row">
              <dt>Slug</dt>
              <dd><code>{product.slug}</code></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Category</dt>
              <dd>{product.category ? (
                <Link href={`/admin/products?category=${product.category.slug}`}>{product.category.label}</Link>
              ) : (
                <span className="admin-muted">Uncategorized</span>
              )}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Status</dt>
              <dd><AdminBadgeStatus status={product.is_active ? "active" : "hidden"} /></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Created</dt>
              <dd>{new Date(product.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
