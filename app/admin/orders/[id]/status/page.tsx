import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getOrderDetail, listAdminNotes, formatCents } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { OrderStatusForm } from "../OrderStatusForm";
import { OrderNotes } from "../OrderNotes";
import { OrderItems } from "../OrderItems";
import { AdminBadgeStatus } from "@/lib/server/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminOrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const order = await getOrderDetail(db, id);
  if (!order) notFound();

  const notes = await listAdminNotes(db, "orders", id, { page: 1, limit: 50 });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/orders" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to orders
        </Link>
        <div className="admin-page-title">
          <h1>Update order status</h1>
          <p className="admin-page-subtitle">{order.ref}</p>
        </div>
        <div className="admin-page-actions">
          <OrderStatusForm orderId={id} currentStatus={order.status} />
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Order summary</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt>Reference</dt>
              <dd><Link href={`/admin/orders/${order.id}`} className="admin-link">{order.ref}</Link></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Customer</dt>
              <dd>{order.first_name} {order.last_name}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Email</dt>
              <dd><a href={`mailto:${order.email}`} className="admin-link">{order.email}</a></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Phone</dt>
              <dd>{order.phone || "—"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Items</dt>
              <dd>{order.item_count} {order.item_count === 1 ? "item" : "items"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Total</dt>
              <dd><strong>{formatCents(order.total)}</strong></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Status</dt>
              <dd><AdminBadgeStatus status={order.status} /></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Created</dt>
              <dd>{new Date(order.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Items</h2>
            <RefreshCw size={14} className="admin-muted" aria-hidden="true" />
          </div>
          <OrderItems items={order.order_items} />
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Internal notes</h2>
          </div>
          <OrderNotes orderId={id} notes={notes.rows} />
        </section>
      </div>
    </div>
  );
}