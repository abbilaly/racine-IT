import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getProductDetail, listStockAdjustments, formatCents } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import { AdminSpinner, AdminEmptyState, AdminError, AdminBadgeStatus, AdminTable, AdminPagination, AdminSearchInput } from "@/lib/server/admin-ui";
import Link from "next/link";
import { ArrowLeft, Package, ArrowUpDown, Edit2, Trash2, Plus, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const product = await getProductDetail(db, id);
  if (!product) notFound();

  const adjustments = await listStockAdjustments(db, id, { page: 1, limit: 100 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/products" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to products
        </Link>
        <div className="admin-page-title">
          <h1>Stock history</h1>
          <p className="admin-page-subtitle">{product.title}</p>
        </div>
        <Link href={`/admin/products/${id}/edit`} className="btn-dark">
          <Edit2 size={16} />
          Edit product
        </Link>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Current stock</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt>On hand</dt>
              <dd>{product.stock.toLocaleString()}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Status</dt>
              <dd><AdminBadgeStatus status={product.stock === 0 ? "out of stock" : product.stock < 5 ? "low stock" : "in stock"} /></dd>
            </div>
          </dl>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Adjustments</h2>
          </div>
          {adjustments.rows.length === 0 ? (
            <AdminEmptyState title="No adjustments recorded" description="Stock changes made through the product page will appear here." />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Change</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Note</th>
                    <th scope="col">Adjusted by</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.rows.map(row => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>
                        <span className={row.change > 0 ? "admin-text-success" : "admin-text-danger"}>
                          {row.change > 0 ? "+" : ""}
                          {row.change}
                        </span>
                      </td>
                      <td>{row.reason}</td>
                      <td className="admin-muted">{row.note ?? "—"}</td>
                      <td className="admin-muted">{row.adjusted_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
