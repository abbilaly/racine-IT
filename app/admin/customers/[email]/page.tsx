import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getCustomer, getCustomerOrders, formatCents } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { email } = await params;
  const decoded = decodeURIComponent(email);

  const customer = await getCustomer(db, decoded);
  if (!customer) notFound();

  const { rows: orders } = await getCustomerOrders(db, customer.email, { page: 1, limit: 100 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/customers" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to customers
        </Link>
        <div className="admin-page-title">
          <h1>{customer.name || customer.email}</h1>
          <p className="admin-page-subtitle">{customer.email}</p>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Profile</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt><Mail size={14} /> Email</dt>
              <dd>
                <a href={`mailto:${customer.email}`} className="admin-link">
                  {customer.email}
                </a>
              </dd>
            </div>
            <div className="admin-definition-row">
              <dt><Phone size={14} /> Phone</dt>
              <dd>{customer.phone || "—"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt><MapPin size={14} /> Location</dt>
              <dd>
                {[customer.city, customer.country].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div className="admin-definition-row">
              <dt><Calendar size={14} /> Last order</dt>
              <dd>
                {customer.last_order_at ? new Date(customer.last_order_at).toLocaleString() : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Summary</h2>
          </div>
          <div className="admin-stats">
            <div className="admin-stat">
              <span>Orders</span>
              <strong>{customer.order_count}</strong>
            </div>
            <div className="admin-stat">
              <span>Total spent</span>
              <strong>{formatCents(customer.total_spent_cents)}</strong>
            </div>
          </div>
          <p className="admin-assistive-text">
            Totals are calculated from stored order records; cancelled orders are excluded.
          </p>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Order history</h2>
          </div>
          {orders.length === 0 ? (
            <AdminEmptyState
              title="No orders yet"
              description="This customer has not placed an order."
            />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Items</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={String(order.id)}>
                      <td>
                        <Link href={`/admin/orders/${String(order.id)}`} className="admin-link-muted">
                          {String(order.ref)}
                        </Link>
                      </td>
                      <td>{String(order.item_count)}</td>
                      <td>{formatCents(Number(order.total))}</td>
                      <td>
                        <AdminBadgeStatus status={String(order.status)} />
                      </td>
                      <td className="admin-muted">
                        {new Date(String(order.created_at)).toLocaleString()}
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