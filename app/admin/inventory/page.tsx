import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listProducts, lowStockProducts, listStockAdjustments } from "@/lib/server/admin-data";
import { AdminPager, AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import Link from "next/link";
import { Package, Search, AlertTriangle, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  const [{ rows: products, total }, low, { rows: adjustments }] = await Promise.all([
    listProducts(db, { q: params.q, page, limit }),
    lowStockProducts(db, 5),
    listStockAdjustments(db, undefined, { page: 1, limit: 20 }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Inventory</h1>
          <p className="admin-page-subtitle">
            {total.toLocaleString()} product{total !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Link href="/admin/products/import" className="btn-outline">
          Import stock
        </Link>
      </div>

      {low.length > 0 && (
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>
              <AlertTriangle size={16} /> Low stock alerts
            </h2>
            <span className="admin-muted">Threshold: 5 units</span>
          </div>
          <div className="admin-notes-list">
            {low.map((row) => (
              <div key={row.id} className="admin-note">
                <div className="admin-note-header">
                  <Link href={`/admin/products/${row.id}/stock`} className="admin-link">
                    {row.title}
                  </Link>
                  <AdminBadgeStatus status={row.stock === 0 ? "out of stock" : "low stock"} />
                </div>
                <p className="admin-note-body">
                  {row.stock} unit{row.stock === 1 ? "" : "s"} remaining · /{row.slug}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="admin-card admin-card--wide">
        <div className="admin-card-header">
          <h2>Stock levels</h2>
        </div>

        <form className="admin-toolbar" method="get" action="/admin/inventory">
          <div className="admin-search">
            <Search size={16} className="admin-icon" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search products…"
              className="admin-search-input"
            />
          </div>
          <input type="hidden" name="page" value="1" />
        </form>

        {products.length === 0 ? (
          <AdminEmptyState
            icon={<Package size={24} />}
            title="No products found"
            description="Adjust the search or add products first."
          />
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="admin-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link href={`/admin/products/${product.id}`} className="admin-link-muted">
                        {product.title}
                      </Link>
                    </td>
                    <td className="admin-muted">{product.slug}</td>
                    <td>
                      <span
                        className={`admin-stock ${
                          product.stock === 0
                            ? "admin-stock--zero"
                            : product.stock < 5
                              ? "admin-stock--low"
                              : ""
                        }`}
                      >
                        {product.stock.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <AdminBadgeStatus
                        status={
                          product.stock === 0 ? "out of stock" : product.stock < 5 ? "low stock" : "in stock"
                        }
                      />
                    </td>
                    <td className="admin-table-actions">
                      <Link
                        href={`/admin/products/${product.id}/stock`}
                        className="admin-action-btn"
                        title="Adjust stock"
                      >
                        <History size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPager page={page} totalPages={totalPages} totalItems={total} params={{ q: params.q }} />
      </section>

      <section className="admin-card admin-card--wide">
        <div className="admin-card-header">
          <h2>Recent stock movements</h2>
        </div>
        {adjustments.length === 0 ? (
          <AdminEmptyState
            icon={<History size={24} />}
            title="No stock adjustments yet"
            description="Manual stock changes are recorded here with a reason."
          />
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
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <td className="admin-muted">{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      <span className={row.change > 0 ? "admin-text-success" : "admin-text-danger"}>
                        {row.change > 0 ? "+" : ""}
                        {row.change}
                      </span>
                    </td>
                    <td>{row.reason}</td>
                    <td className="admin-muted">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}