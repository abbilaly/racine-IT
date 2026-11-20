"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Package, ArrowRight } from "lucide-react";
import { useCustomerSession } from "../CustomerSessionProvider";
import { formatPrice } from "@/lib/products";

type CustomerOrder = {
  id: string;
  ref: string;
  status: string;
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
};

const STATUS_ORDER: Record<string, number> = {
  cancelled: 0,
  received: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
};

export default function OrdersContent({ currency }: { currency: string }) {
  const { session, refresh, loading: sessionLoading } = useCustomerSession();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  const loadOrders = async (p: number) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/orders?page=${p}&limit=${limit}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not load your orders. Please try again.");
        return;
      }
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("We could not load your orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadOrders(page);
  }, [session, page, refresh]);

  if (sessionLoading) {
    return (
      <div className="account-loading">
        <div className="account-spinner" aria-hidden="true" />
        <p>Loading your orders…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="account-empty">
        <h2>Sign in to see your orders</h2>
        <p>
          You&apos;re not signed in. Orders placed today are guest orders, so use the reference from
          your confirmation page to look one up, or sign in to see any order already linked to your
          account.
        </p>
        <div className="account-actions">
          <Link href="/account/signin" className="btn btn-primary">Sign in</Link>
          <Link href="/account" className="btn btn-outline">Back to account</Link>
        </div>
      </div>
    );
  }

  const visible = orders.slice(0, limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}

      {visible.length === 0 && !loading ? (
        <div className="account-empty">
          <ShoppingBag size={32} strokeWidth={1.4} className="account-empty-icon" />
          <h2>No orders yet</h2>
          <p>
            You haven&apos;t placed any orders with this account yet. Browse the shop to find something you
            like.
          </p>
          <Link href="/shop" className="btn btn-primary">
            Visit the shop <ArrowRight size={16} strokeWidth={1.7} />
          </Link>
        </div>
      ) : (
        <div className="account-orders-list">
          {visible.map(order => {
            const statusRank = STATUS_ORDER[order.status] ?? 99;
            return (
              <article key={order.id} className="order-card">
                <div className="order-card-head">
                  <div className="order-ref">
                    <Package size={16} strokeWidth={1.7} />
                    <div>
                      <h3>Order {order.ref}</h3>
                      <p className="muted-note">
                        Placed {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-status status-${order.status}`}>{order.status}</span>
                </div>

                <ul className="order-items-preview">
                  {[{ slug: "item", title: "Items", qty: order.itemCount, total: order.subtotal }].map(
                    (_ => null) // placeholder; real items are loaded on the detail page
                  )}
                </ul>

                <div className="order-card-footer">
                  <div className="order-totals">
                    <div className="order-total-row">
                      <span>Subtotal</span>
                      <span>{formatPrice(order.subtotal, currency)}</span>
                    </div>
                    {order.shipping > 0 && (
                      <div className="order-total-row">
                        <span>Shipping</span>
                        <span>{formatPrice(order.shipping, currency)}</span>
                      </div>
                    )}
                    <div className="order-total-row order-total-final">
                      <span>Total</span>
                      <span>{formatPrice(order.total, currency)}</span>
                    </div>
                  </div>
                  <Link href={`/account/order/${order.id}`} className="btn-outline">
                    View details <ArrowRight size={14} strokeWidth={1.7} />
                  </Link>
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <nav className="account-pagination" aria-label="Orders pagination">
              {page > 1 && (
                <button className="btn-outline page-prev" onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Previous
                </button>
              )}
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <button className="btn-outline page-next" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ArrowRight size={14} strokeWidth={1.7} />
                </button>
              )}
            </nav>
          )}
        </div>
      )}

      <section className="account-need-help">
        <h2>Need help with an order?</h2>
        <p>
          Email{" "}
          <a href={`mailto:support@abtech.example`} className="link-underline">
            support@abtech.example
          </a>{" "}
          with your order reference and our team will take a look.
        </p>
      </section>
    </>
  );
}
