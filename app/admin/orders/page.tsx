import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import { formatCents } from "@/lib/orders";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

const FILTERS = ["received", "processing", "shipped", "delivered", "cancelled"] as const;

type OrderRow = {
  id: string;
  ref: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  item_count: number;
  total: number;
  created_at: string;
};

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);

  const { status } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(status ?? "") ? status : undefined;

  let query = db
    .from("orders")
    .select("id,ref,status,first_name,last_name,email,item_count,total,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) query = query.eq("status", filter);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as OrderRow[];

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Orders</h1>
          <p>{error ? "Could not load orders" : `${rows.length} order${rows.length === 1 ? "" : "s"}${filter ? ` (${filter})` : ""}`}</p>
        </div>
      </div>

      <nav className="admin-filters" aria-label="Filter orders by status">
        <Link href="/admin/orders" className={filter ? "" : "is-on"}>All</Link>
        {FILTERS.map(value => (
          <Link key={value} href={`/admin/orders?status=${value}`} className={filter === value ? "is-on" : ""}>
            {value[0].toUpperCase() + value.slice(1)}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="empty-state">
          <h2>The database could not be reached</h2>
          <p>{error.message}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h2>No orders here</h2>
          <p>Orders placed through checkout appear here immediately.</p>
        </div>
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
            {rows.map(order => (
              <tr key={order.id}>
                <td><Link href={`/admin/orders/${order.id}`}>{order.ref}</Link></td>
                <td>
                  <strong>{order.first_name} {order.last_name}</strong>
                  <small className="admin-sub">{order.email}</small>
                </td>
                <td>{order.item_count}</td>
                <td>{formatCents(order.total)}</td>
                <td><OrderStatusSelect id={order.id} value={order.status} /></td>
                <td>
                  {new Date(order.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
