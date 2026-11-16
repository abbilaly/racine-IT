import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getOrderDetail, listAdminNotes } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, User, Mail, Phone, MapPin, Calendar, FileText, AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, Eye } from "lucide-react";
import { AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import { OrderStatusForm } from "./OrderStatusForm";
import { OrderNotes } from "./OrderNotes";
import { OrderItems } from "./OrderItems";
import { deliveryLabel, paymentLabel } from "@/lib/server/orders";
import { formatCents } from "@/lib/server/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
          <h1>Order detail</h1>
          <p className="admin-page-subtitle">{order.ref}</p>
        </div>
        <div className="admin-page-actions">
          <Link href={`/admin/orders/${id}/email-preview`} className="btn-outline">
            <Eye size={16} />
            Email preview
          </Link>
          <Link href={`/admin/orders/${id}/status`} className="btn-outline">
            <RefreshCw size={16} />
            Update status
          </Link>
          <OrderStatusForm orderId={id} currentStatus={order.status} />
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Order summary</h2>
            <div className="admin-order-meta">
              <span className="admin-order-meta-item">
                <Calendar size={14} />
                {new Date(order.created_at).toLocaleString()}
              </span>
              <span className="admin-order-meta-item">
                <Package size={14} />
                {order.item_count} {order.item_count === 1 ? "item" : "items"}
              </span>
            </div>
          </div>

          <dl className="admin-definition-list admin-definition-list--inline">
            <div className="admin-definition-row">
              <dt>Status</dt>
              <dd><AdminBadgeStatus status={order.status} /></dd>
            </div>
            <div className="admin-definition-row">
              <dt>Payment</dt>
              <dd>{paymentLabel(order.payment)}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Delivery</dt>
              <dd>{deliveryLabel(order.delivery)}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Subtotal</dt>
              <dd>{order.subtotal ? formatCents(order.subtotal) : "—"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Shipping</dt>
              <dd>{order.shipping ? formatCents(order.shipping) : "—"}</dd>
            </div>
            <div className="admin-definition-row admin-definition-row--total">
              <dt>Total</dt>
              <dd><strong>{formatCents(order.total)}</strong></dd>
            </div>
          </dl>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Items</h2>
          </div>
          <OrderItems items={order.order_items} />
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Customer</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt><User size={14} /> Name</dt>
              <dd>{order.first_name} {order.last_name}</dd>
            </div>
            <div className="admin-definition-row">
              <dt><Mail size={14} /> Email</dt>
              <dd><a href={`mailto:${order.email}`} className="admin-link">{order.email}</a></dd>
            </div>
            <div className="admin-definition-row">
              <dt><Phone size={14} /> Phone</dt>
              <dd>{order.phone || "—"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt><MapPin size={14} /> Address</dt>
              <dd>
                {order.address}<br></br>
                {order.city}, {order.postal}<br></br>
                {order.country}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Notes</h2>
            <OrderNotes orderId={id} />
          </div>
          {notes.rows.length > 0 ? (
            <div className="admin-notes-list">
              {notes.rows.map((note) => (
                <div key={note.id} className="admin-note">
                  <div className="admin-note-header">
                    <span className="admin-note-author">{note.author_email || "System"}</span>
                    <span className="admin-note-date">{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <p className="admin-note-body">{note.note}</p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              icon={<FileText size={24} />}
              title="No notes yet"
              description="Add internal notes about this order."
            />
          )}
        </section>
      </div>
    </div>
  );
}
