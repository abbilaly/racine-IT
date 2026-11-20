"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, MapPin, Clock, Truck, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/products";
import type { StoredOrder } from "@/lib/orders";

type OrderDetail = StoredOrder & {
  ref: string;
};

const STATUS_ICONS: Record<string, typeof Package> = {
  received: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderDetailClient({ orderId, currency }: { orderId: string; currency: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/auth/orders/${orderId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "We could not load that order. Please try again.");
          return;
        }
        if (!data.order) {
          setError("That order was not found or is not yours.");
          return;
        }
        if (!cancelled) setOrder(data.order as OrderDetail);
      } catch {
        if (!cancelled) setError("We could not load that order. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <main className="site-shell page account-form-page">
        <div className="account-loading">
          <div className="account-spinner" aria-hidden="true" />
          <p>Loading order…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="site-shell page account-form-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/account/orders">My Orders</Link> <span>/</span>
          <span aria-current="page">Order</span>
        </nav>
        <div className="account-empty">
          <h2>{error}</h2>
          <p>
            <button className="btn btn-outline" onClick={() => router.back()}>
              Go back
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  const StatusIcon = STATUS_ICONS[order.status] ?? Package;
  const deliveryLabel = order.delivery === "express" ? "Express delivery" : "Standard delivery";
  const paymentLabel =
    order.payment === "card"
      ? "Card payment"
      : order.payment === "paypal"
      ? "PayPal"
      : "Cash on delivery";

  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account/orders">My Orders</Link> <span>/</span>
        <span aria-current="page">Order {order.ref}</span>
      </nav>

      <div className="page-heading">
        <h1>Order {order.ref}</h1>
        <p>
          Placed{" "}
          {new Date(order.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="order-detail">
        <div className="order-status-block">
          <div className="order-status-icon">
            <StatusIcon size={32} strokeWidth={1.4} />
          </div>
          <div className="order-status-text">
            <h2>{STATUS_LABELS[order.status] ?? order.status}</h2>
            <p className="muted-note">
              {order.status === "cancelled" && "This order was cancelled."}
              {order.status === "delivered" && "Your order has been delivered."}
              {order.status === "shipped" && "Your order is on its way."}
              {order.status === "processing" && "We're preparing your order."}
              {order.status === "received" && "We've received your order and are getting it ready."}
            </p>
          </div>
          <span className={`badge badge-status status-${order.status}`}>{STATUS_LABELS[order.status] ?? order.status}</span>
        </div>

        <div className="order-columns">
          <div className="order-column">
            <h3>Items ({order.itemCount})</h3>
            {order.items.length === 0 ? (
              <p className="muted-note">No items recorded for this order.</p>
            ) : (
              <ul className="order-items">
                {order.items.map(item => (
                  <li key={`${order.id}-${item.slug}-${item.unitPrice}-${item.qty}`} className="order-item">
                    <div className="order-item-main">
                      <div>
                        <h4>{item.title}</h4>
                        {item.variantName && <p className="muted-note">{item.variantName}</p>}
                      </div>
                      <div className="order-item-right">
                        <div className="order-item-qty">{item.qty} × {formatPrice(item.unitPrice, currency)}</div>
                        <div className="order-item-total">{formatPrice(item.lineTotal, currency)}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="order-column">
            <h3>Delivery</h3>
            <dl className="order-info">
              <div>
                <dt>Method</dt>
                <dd>{deliveryLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="order-column">
            <h3>Payment</h3>
            <dl className="order-info">
              <div>
                <dt>Method</dt>
                <dd>{paymentLabel}</dd>
              </div>
            </dl>
            <p className="order-payment-note muted-note">
              This order was placed through the storefront checkout. No real payment was processed — if a
              payment provider is configured later, completed payments will appear here.
            </p>
          </div>

          <div className="order-column">
            <h3>Shipping address</h3>
            <dl className="order-info">
              <div>
                <dt>Name</dt>
                <dd>{order.customer.firstName} {order.customer.lastName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{order.customer.email}</dd>
              </div>
              {order.customer.phone && (
                <div>
                  <dt>Phone</dt>
                  <dd>{order.customer.phone}</dd>
                </div>
              )}
              <div>
                <dt>Address</dt>
                <dd>{order.customer.address}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{order.customer.city}</dd>
              </div>
              <div>
                <dt>Postal code</dt>
                <dd>{order.customer.postal}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>{order.customer.country}</dd>
              </div>
            </dl>
          </div>

          {order.note && (
            <div className="order-column">
              <h3>Customer note</h3>
              <p className="order-note">{order.note}</p>
              <p className="muted-note">This was the note you added at checkout.</p>
            </div>
          )}
        </div>

        <div className="order-totals-block">
          <h3>Order total</h3>
          <dl className="order-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal, currency)}</dd>
            </div>
            {order.shipping > 0 && (
              <div>
                <dt>Shipping</dt>
                <dd>{formatPrice(order.shipping, currency)}</dd>
              </div>
            )}
            <div className="order-total-final">
              <dt>Total</dt>
              <dd>{formatPrice(order.total, currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="account-actions order-actions">
          <Link href="/account/orders" className="btn btn-outline">
            <ArrowLeft size={14} strokeWidth={1.7} />
            Back to my orders
          </Link>
          <Link href="/account" className="btn btn-outline">
            Back to account
          </Link>
        </div>
      </div>
    </main>
  );
}
