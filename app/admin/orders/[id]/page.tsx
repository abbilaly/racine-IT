import Link from "next/link";
import { notFound } from "next/navigation";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import { formatCents } from "@/lib/orders";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

type ItemRow = {
  slug: string;
  title: string;
  variant_name: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
  snapshot: Record<string, unknown> | null;
};

type OrderDetail = {
  id: string;
  ref: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
  country: string;
  delivery: string;
  payment: string;
  note: string | null;
  item_count: number;
  subtotal: number;
  shipping: number;
  total: number;
  created_at: string;
  order_items: ItemRow[];
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const { data, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="admin-page">
        <div className="empty-state">
          <h2>The order could not be loaded</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }
  if (!data) notFound();

  const order = data as unknown as OrderDetail;
  const items = [...order.order_items].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Order {order.ref}</h1>
          <p>
            Placed {new Date(order.created_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short"
            })}
          </p>
        </div>
        <div className="admin-order-status">
          <OrderStatusSelect id={order.id} value={order.status} />
        </div>
      </div>

      <div className="admin-order-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Items</h2></div>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Unit</th>
                <th scope="col">Qty</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={`${item.slug}-${item.title}`}>
                  <td>
                    <strong>{item.title}</strong>
                    <small className="admin-sub">
                      /product/{item.slug}
                      {item.variant_name ? ` · ${item.variant_name}` : ""}
                    </small>
                    <small className="admin-sub">
                      snapshot saved: {String((item.snapshot as { title?: string })?.title ?? "yes")}
                    </small>
                  </td>
                  <td>{formatCents(item.unit_price)}</td>
                  <td>{item.qty}</td>
                  <td>{formatCents(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="admin-totals">
            <div><dt>Subtotal</dt><dd>{formatCents(order.subtotal)}</dd></div>
            <div><dt>Shipping · {order.delivery === "express" ? "Express" : "Standard"}</dt><dd>{order.shipping === 0 ? "FREE" : formatCents(order.shipping)}</dd></div>
            <div><dt>Payment</dt><dd>{order.payment.toUpperCase()}</dd></div>
            <div className="admin-total"><dt>Total</dt><dd>{formatCents(order.total)}</dd></div>
          </dl>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Customer</h2></div>
          <address className="admin-address">
            <strong>{order.first_name} {order.last_name}</strong><br />
            {order.address}<br />
            {order.city}, {order.postal}<br />
            {order.country}<br /><br />
            {order.email}<br />
            {order.phone}
          </address>
          {order.note && <p className="order-note">“{order.note}”</p>}
          <Link href="/admin/orders" className="admin-back">← All orders</Link>
        </section>
      </div>
    </div>
  );
}
