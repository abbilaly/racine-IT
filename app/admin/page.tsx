import Link from "next/link";
import { formatCents } from "@/lib/orders";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

const ORDER_STATUS_LABEL: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const [ordersCount, productsCount, lowStock, recentOrders] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }),
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("inventory").select("on_hand, product:products(title)").lte("on_hand", 5).is("variant_id", null),
    db
      .from("orders")
      .select("id, ref, status, first_name, last_name, item_count, total, created_at")
      .order("created_at", { ascending: false })
      .limit(6)
  ]);

  if (ordersCount.error || productsCount.error || lowStock.error || recentOrders.error) {
    const message =
      ordersCount.error?.message ?? productsCount.error?.message ?? lowStock.error?.message ?? "";
    return (
      <div className="admin-page">
        <div className="empty-state">
          <h2>The database could not be reached</h2>
          <p>{message || "Check the Supabase configuration for this environment."}</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Orders", value: String(ordersCount.count ?? 0), href: "/admin/orders" },
    { label: "Products", value: String(productsCount.count ?? 0), href: "/admin/products" },
    { label: "Low stock lines", value: String(lowStock.data?.length ?? 0), href: "/admin/products" },
    {
      label: "Signed in as",
      value: session.email || session.role,
      href: "/admin/settings"
    }
  ];

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Live data from Supabase</p>
        </div>
        <Link href="/admin/orders" className="btn-dark">Manage orders</Link>
      </div>

      <div className="admin-stats">
        {stats.map(stat => (
          <Link href={stat.href} key={stat.label} className="admin-stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </Link>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Recent orders</h2>
          <Link href="/admin/orders">View all</Link>
        </div>
        {(recentOrders.data ?? []).length === 0 ? (
          <p className="muted-note">No orders yet. Orders appear here as soon as checkout saves one.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Placed</th>
              </tr>
            </thead>
            <tbody>
              {(recentOrders.data ?? []).map(order => (
                <tr key={order.id}>
                  <td><Link href={`/admin/orders/${order.id}`}>{order.ref}</Link></td>
                  <td>{order.first_name} {order.last_name}</td>
                  <td>{order.item_count}</td>
                  <td>{formatCents(order.total)}</td>
                  <td><span className={`admin-status is-${order.status}`}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</span></td>
                  <td>{new Date(order.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
