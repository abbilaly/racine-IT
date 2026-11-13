import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listOrders, formatCents } from "@/lib/server/admin-data";
import { AdminPager, AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import Link from "next/link";
import { Search, Package, ArrowUpDown, Filter, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const { rows: orders, total } = await listOrders(db, {
    status: params.status as string,
    q: params.q,
    from: params.from,
    to: params.to,
    page,
    limit,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Orders</h1>
          <p className="admin-page-subtitle">{total.toLocaleString()} order{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="admin-page-actions admin-page-actions--right">
          <Link href="/admin/orders/import" className="btn-outline">
            <Search size={16} />
            Import orders
          </Link>
        </div>
      </div>

      <form className="admin-toolbar" method="get" action="/admin/orders">
        <div className="admin-search">
          <Search size={16} className="admin-icon" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search by email, name, or reference…"
            className="admin-search-input"
          />
        </div>

        <div className="admin-filters">
          <label className="admin-filter">
            <Filter size={14} />
            <span>Status</span>
            <select name="status" defaultValue={params.status ?? "all"} className="admin-select">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-filter">
            <Calendar size={14} />
            <span>From</span>
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="admin-input admin-input--date"
            />
          </label>

          <label className="admin-filter">
            <span>To</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="admin-input admin-input--date"
            />
          </label>

          <input type="hidden" name="page" value="1" />
          <button className="btn-outline" type="submit">
            Apply filters
          </button>
          <a href="/admin/orders" className="btn-outline">
            Clear
          </a>
        </div>
      </form>

      {orders.length === 0 ? (
        <AdminEmptyState
          icon={<Package size={32} />}
          title="No orders found"
          description="Orders will appear here once customers complete checkout."
        />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Customer</th>
                <th scope="col">Email</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="admin-order-link">
                      <span className="admin-order-ref">{order.ref}</span>
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="admin-order-customer">
                      {order.first_name} {order.last_name}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="admin-link-muted admin-order-email">
                      {order.email}
                    </Link>
                  </td>
                  <td>
                    <span className="admin-order-items">{order.item_count} {order.item_count === 1 ? "item" : "items"}</span>
                  </td>
                  <td>
                    <span className="admin-order-total">{formatCents(order.total)}</span>
                  </td>
                  <td>
                    <AdminBadgeStatus status={order.status} />
                  </td>
                  <td>
                    <span className="admin-order-date">{new Date(order.created_at).toLocaleString()}</span>
                  </td>
                  <td className="admin-table-actions">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="admin-action-btn"
                      title="View"
                    >
                      <ArrowUpDown size={14} />
                    </Link>
                    <Link
                      href={`/admin/orders/${order.id}/edit`}
                      className="admin-action-btn"
                      title="Edit"
                    >
                      <Filter size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager
        page={page}
        totalPages={totalPages}
        totalItems={total}
        params={{
          q: params.q,
          status: params.status && params.status !== "all" ? params.status : undefined,
          from: params.from,
          to: params.to,
        }}
      />
    </div>
  );
}
