"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { formatPrice, imageUrl } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

export default function CartView() {
  const { cart, hydrated, setQty, removeFromCart, cartCount, cartTotal, getProduct } = useShop();

  if (!hydrated) return <p className="muted-note">Loading your cart…</p>;

  const lines = cart
    .map(line => ({ line, product: getProduct(line.slug) }))
    .filter((entry): entry is { line: typeof cart[number]; product: NonNullable<ReturnType<typeof getProduct>> } =>
      Boolean(entry.product)
    );

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <ShoppingBag size={34} strokeWidth={1.4} />
        <h2>Your cart is currently empty</h2>
        <p>Check out all the available products and buy some in the shop.</p>
        <Link href="/shop" className="btn-dark">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <section className="cart-lines" aria-label="Cart items">
        <div className="cart-lines-head">
          <span aria-hidden />
          <span>Product</span>
          <span>Quantity</span>
          <span>Total</span>
        </div>

        {lines.map(({ line, product }) => (
          <article className="cart-line" key={product.slug}>
            <Link href={`/product/${product.slug}`} className="cart-line-image">
              <img src={imageUrl(product.image)} alt={product.title} />
            </Link>

            <div className="cart-line-info">
              <Link href={`/product/${product.slug}`}>{product.title}</Link>
              <small>{formatPrice(product.price)} each</small>
              <button className="cart-remove" onClick={() => removeFromCart(product.slug)}>
                <Trash2 size={13} /> Remove
              </button>
            </div>

            <div className="qty-stepper cart-qty" role="group" aria-label={`Quantity for ${product.title}`}>
              <button aria-label="Decrease quantity" onClick={() => setQty(product.slug, line.qty - 1)}>
                <Minus size={14} />
              </button>
              <span aria-live="polite">{line.qty}</span>
              <button
                aria-label="Increase quantity"
                disabled={line.qty >= product.stock}
                onClick={() => setQty(product.slug, line.qty + 1)}
              >
                <Plus size={14} />
              </button>
            </div>

            <strong className="cart-line-total">{formatPrice(product.price * line.qty)}</strong>
          </article>
        ))}

        <Link href="/shop" className="cart-continue">← Continue shopping</Link>
      </section>

      <aside className="cart-summary" aria-label="Order summary">
        <h2>Order Summary</h2>
        <dl>
          <div>
            <dt>Items ({cartCount})</dt>
            <dd>{formatPrice(cartTotal)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd className="free">FREE</dd>
          </div>
          <div>
            <dt>Estimated tax</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>
        <div className="cart-total-row">
          <span>Total</span>
          <strong>{formatPrice(cartTotal)}</strong>
        </div>
        <Link href="/checkout" className="btn-dark cart-checkout">Proceed to Checkout</Link>
        <p className="cart-note"><Truck size={14} /> Free worldwide shipping and 15-day returns.</p>
      </aside>
    </div>
  );
}
