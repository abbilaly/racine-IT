import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import {
  salesReport,
  bestSellingProducts,
  lowStockProducts,
  ordersByStatus,
  last30Days,
  formatCents,
} from "@/lib/server/admin-data";
import { AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import { BarChart3, TrendingUp, Package, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const to = params.to || new Date().toISOString();
  const from = params.from || last30Days();

  const [sales, best, low, byStatus] = await Promise.all([
    salesReport(db, from, to),
    bestSellingProducts(db, 20),
    lowStockProducts(db, 5),
    ordersByStatus(db),
  ]);

  const totalRevenue = sales.reduce((sum, point) => sum + point.revenue_cents, 0);
  const totalOrders = sales.reduce((sum, point) => sum + point.orders, 0);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Reports</h1>
          <p className="admin-page-subtitle">Sales, orders and inventory from live database records</p>
        </div>
      </div>

      <form className="admin-toolbar" method="get" action="/admin/reports">
        <div className="admin-filters">
          <label className="admin-filter">
            <span>From</span>
            <input
              type="date"
              name="from"
              defaultValue={from.slice(0, 10)}
              className="admin-input admin-input--date"
            />
          </label>
          <label className="admin-filter">
            <span>To</span>
            <input
              type="date"
              name="to"
              defaultValue={to.slice(0, 10)}
              className="admin-input admin-input--date"
            />
          </label>
          <button className="btn-outline" type="submit">
            Apply range
          </button>
        </div>
      </form>

      <div className="admin-stats">
        <div className="admin-stat">
          <span>Revenue in range</span>
          <strong>{formatCents(totalRevenue)}</strong>
        </div>
        <div className="admin-stat">
          <span>Orders in range</span>
          <strong>{totalOrders.toLocaleString()}</strong>
        </div>
        <div className="admin-stat">
          <span>Best-selling products</span>
          <strong>{best.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Low-stock products</span>
          <strong>{low.length}</strong>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Sales over time</h2>
          </div>
          {sales.length === 0 ? (
            <AdminEmptyState
              icon={<TrendingUp size={24} />}
              title="No sales in this range"
              description="Choose a wider date range."
            />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((point) => (
                    <tr key={point.period}>
                      <td>{point.period}</td>
                      <td>{point.orders}</td>
                      <td>{formatCents(point.revenue_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Orders by status</h2>
          </div>
          {byStatus.length === 0 ? (
            <AdminEmptyState icon={<ShoppingCart size={24} />} title="No orders yet" />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byStatus.map((row) => (
                    <tr key={row.status}>
                      <td>
                        <AdminBadgeStatus status={row.status} />
                      </td>
                      <td>{row.count}</td>
                      <td>{formatCents(row.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Best-selling products</h2>
          </div>
          {best.length === 0 ? (
            <AdminEmptyState icon={<Package size={24} />} title="No product sales yet" />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Units</th>
                    <th scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {best.map((row) => (
                    <tr key={row.slug}>
                      <td>{row.title}</td>
                      <td>{row.units_sold}</td>
                      <td>{formatCents(row.revenue_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Low stock</h2>
          </div>
          {low.length === 0 ? (
            <AdminEmptyState
              icon={<Package size={24} />}
              title="Everything is stocked"
              description="No product is below the threshold of 5 units."
            />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {low.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>
                        <span className="admin-stock admin-stock--low">{row.stock}</span>
                      </td>
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