"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { formatPrice, getProduct, imageUrl } from "@/lib/products";
import { useShop } from "@/lib/shop-store";
import {
  EXPRESS_FEE,
  type CreateOrderRequest,
  type DeliveryMethod,
  type PaymentMethod
} from "@/lib/orders";

const PAYMENT_METHODS = [
  { key: "card", label: "Credit / debit card" },
  { key: "paypal", label: "PayPal" },
  { key: "cod", label: "Cash on delivery" }
] as const;

type Phase = "form" | "saving" | "done";

export default function CheckoutView() {
  const router = useRouter();
  const { cart, hydrated, cartCount, cartTotal, clearCart } = useShop();
  const [delivery, setDelivery] = useState<DeliveryMethod>("standard");
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [placedRef, setPlacedRef] = useState<string | null>(null);

  if (!hydrated) return <p className="muted-note">Loading checkout…</p>;

  const lines = cart
    .map(line => ({ line, product: getProduct(line.slug) }))
    .filter(entry => Boolean(entry.product));

  if (lines.length === 0 && phase === "form") {
    return (
      <div className="empty-state">
        <h2>Nothing to check out</h2>
        <p>Add something to your cart first — your cart is saved on this device.</p>
        <Link href="/shop" className="btn-dark">Browse products</Link>
      </div>
    );
  }

  const shipping = delivery === "express" ? EXPRESS_FEE : 0;
  const total = cartTotal + shipping;

  if (phase === "done" && placedRef) {
    return (
      <div className="checkout-done">
        <CheckCircle2 size={38} strokeWidth={1.5} />
        <h2>Order {placedRef} saved</h2>
        <p>
          Your order is stored in our order system and we have your delivery details. No payment
          was taken on this page.
        </p>
        <p className="muted-note">Taking you to your order confirmation…</p>
        <div className="checkout-done-actions">
          <Link href={`/order/${placedRef}`} className="btn-dark">View order</Link>
          <Link href="/shop" className="btn-outline">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      <form
        className="checkout-form"
        onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const data = new FormData(form);
          const payload: CreateOrderRequest = {
            items: cart.map(line => ({ slug: line.slug, qty: line.qty })),
            customer: {
              firstName: String(data.get("firstName") ?? ""),
              lastName: String(data.get("lastName") ?? ""),
              email: String(data.get("email") ?? ""),
              phone: String(data.get("phone") ?? ""),
              address: String(data.get("address") ?? ""),
              city: String(data.get("city") ?? ""),
              postal: String(data.get("postal") ?? ""),
              country: String(data.get("country") ?? "")
            },
            delivery,
            payment
          };

          setPhase("saving");
          setError(null);
          try {
            const response = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const body = (await response.json().catch(() => ({}))) as { ref?: string; error?: string };
            if (!response.ok || !body.ref) {
              setError(body.error ?? "We could not save your order. Please try again.");
              setPhase("form");
              return;
            }
            setPlacedRef(body.ref);
            setPhase("done");
            clearCart();
            router.push(`/order/${body.ref}`);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {
            setError("We could not reach the store. Check your connection and try again.");
            setPhase("form");
          }
        }}
      >
        <fieldset>
          <legend><span>1</span> Contact</legend>
          <div className="field-row">
            <label className="field">
              Email address
              <input type="email" name="email" autoComplete="email" required placeholder="you@example.com" />
            </label>
            <label className="field">
              Phone
              <input type="tel" name="phone" autoComplete="tel" required placeholder="+1 555 000 1234" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>2</span> Delivery address</legend>
          <div className="field-row">
            <label className="field">
              First name
              <input type="text" name="firstName" autoComplete="given-name" required />
            </label>
            <label className="field">
              Last name
              <input type="text" name="lastName" autoComplete="family-name" required />
            </label>
          </div>
          <label className="field">
            Address
            <input type="text" name="address" autoComplete="street-address" required />
          </label>
          <div className="field-row">
            <label className="field">
              City
              <input type="text" name="city" autoComplete="address-level2" required />
            </label>
            <label className="field">
              Postal code
              <input
                type="text"
                name="postal"
                autoComplete="postal-code"
                inputMode="numeric"
                required
                pattern="[A-Za-z0-9 -]{3,10}"
                title="3–10 letters or digits"
              />
            </label>
          </div>
          <label className="field">
            Country
            <select name="country" autoComplete="country" defaultValue="US" required>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend><span>3</span> Delivery method</legend>
          <label className={`choice ${delivery === "standard" ? "is-on" : ""}`}>
            <input
              type="radio"
              name="delivery"
              checked={delivery === "standard"}
              onChange={() => setDelivery("standard")}
            />
            <span>
              <strong>Standard delivery</strong>
              <small>5–7 business days, tracked</small>
            </span>
            <b>FREE</b>
          </label>
          <label className={`choice ${delivery === "express" ? "is-on" : ""}`}>
            <input
              type="radio"
              name="delivery"
              checked={delivery === "express"}
              onChange={() => setDelivery("express")}
            />
            <span>
              <strong>Express delivery</strong>
              <small>1–2 business days, tracked</small>
            </span>
            <b>{formatPrice(EXPRESS_FEE)}</b>
          </label>
        </fieldset>

        <fieldset>
          <legend><span>4</span> Payment</legend>
          <div className="payment-list">
            {PAYMENT_METHODS.map(method => (
              <label key={method.key} className={`choice ${payment === method.key ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === method.key}
                  onChange={() => setPayment(method.key)}
                />
                <span><strong>{method.label}</strong></span>
              </label>
            ))}
          </div>
          <p className="checkout-disclosure">
            <Lock size={13} /> Demo storefront — no payment provider is connected, so no card details
            are collected and nothing is charged.
          </p>
        </fieldset>

        {error && <p className="checkout-error" role="alert">{error}</p>}
        <button type="submit" className="btn-dark checkout-submit" disabled={phase === "saving"}>
          {phase === "saving" ? "Placing your order…" : `Place order · ${formatPrice(total)}`}
        </button>
        <p className="checkout-hint">
          Your order is saved to our order system. No payment is taken on this page — we confirm
          payment and delivery with you afterwards, and card details are never requested here.
        </p>
      </form>

      <aside className="checkout-summary" aria-label="Order summary">
        <h2>Your Order ({cartCount})</h2>
        <ul className="checkout-items">
          {lines.map(({ line, product }) => (
            <li key={product!.slug}>
              <img src={imageUrl(product!.image)} alt="" width={52} height={52} />
              <span>
                <strong>{product!.title}</strong>
                <small>Qty {line.qty} · {formatPrice(product!.price)}</small>
              </span>
              <b>{formatPrice(product!.price * line.qty)}</b>
            </li>
          ))}
        </ul>
        <dl className="checkout-totals">
          <div><dt>Subtotal</dt><dd>{formatPrice(cartTotal)}</dd></div>
          <div><dt>Shipping</dt><dd>{shipping === 0 ? <span className="free">FREE</span> : formatPrice(shipping)}</dd></div>
          <div className="checkout-grand"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
        </dl>
        <p className="cart-note"><Lock size={13} /> Your cart is saved on this device only.</p>
      </aside>
    </div>
  );
}
