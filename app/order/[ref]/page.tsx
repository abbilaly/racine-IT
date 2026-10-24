import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { OrderError, getOrder } from "@/lib/server/orders";
import { formatCents, normaliseRef } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ref: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Order ${normaliseRef(ref)} — Racine IT` };
}

export default async function OrderPage({ params }: Params) {
  const { ref } = await params;

  let order;
  try {
    order = await getOrder(ref);
  } catch (error) {
    const message =
      error instanceof OrderError ? error.message : "The order service is unavailable right now.";
    return (
      <main className="site-shell page">
        <div className="empty-state">
          <h2>We could not load that order</h2>
          <p>{message}</p>
          <Link href="/" className="btn-dark">Back to the storefront</Link>
        </div>
      </main>
    );
  }

  if (!order) notFound();

  const placedAt = new Date(order.createdAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span>
        <Link href="/account">Account</Link> <span>/</span>
        <span aria-current="page">{order.ref}</span>
      </nav>

      <div className="page-heading">
        <h1>Order {order.ref}</h1>
        <p>Placed {placedAt}</p>
      </div>

      <div className="order-confirm">
        <CheckCircle2 size={30} strokeWidth={1.6} />
        <div>
          <h2>Order received</h2>
          <p>
            Saved to our order system with {order.itemCount} item{order.itemCount === 1 ? "" : "s"}{" "}
            totalling <strong>{formatCents(order.total)}</strong>. We'll contact you at{" "}
            {order.customer.email} to confirm payment and delivery.
          </p>
          <p className="muted-note">
            Status: <b>{order.status}</b> · No payment was processed on this page.
          </p>
        </div>
      </div>

      <div className="order-layout">
        <section className="order-items" aria-label="Order items">
          <h2>Items</h2>
          <ul>
            {order.items.map(item => (
              <li key={item.slug}>
                <Link href={`/product/${item.slug}`}>{item.title}</Link>
                <span>
                  {formatCents(item.unitPrice)} × {item.qty}
                </span>
                <strong>{formatCents(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>

          <div className="order-address">
            <h3>Delivery address</h3>
            <p>
              {order.customer.firstName} {order.customer.lastName}
              <br />
              {order.customer.address}
              <br />
              {order.customer.city}, {order.customer.postal}
              <br />
              {order.customer.country}
            </p>
            <p>
              {order.customer.phone}
              <br />
              {order.customer.email}
            </p>
          </div>
        </section>

        <aside className="order-summary" aria-label="Order summary">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Items ({order.itemCount})</dt>
              <dd>{formatCents(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping · {order.delivery === "express" ? "Express" : "Standard"}</dt>
              <dd>{order.shipping === 0 ? <span className="free">FREE</span> : formatCents(order.shipping)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{order.payment === "cod" ? "Cash on delivery" : order.payment === "paypal" ? "PayPal" : "Card"}</dd>
            </div>
          </dl>
          <div className="cart-total-row">
            <span>Total</span>
            <strong>{formatCents(order.total)}</strong>
          </div>
          {order.note && <p className="order-note">“{order.note}”</p>}
          <Link href="/shop" className="btn-dark cart-checkout">Continue shopping</Link>
          <Link href="/account" className="order-secondary">Look up another order</Link>
        </aside>
      </div>
    </main>
  );
}
