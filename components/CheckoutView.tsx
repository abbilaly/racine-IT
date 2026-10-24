"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { formatPrice, getProduct, imageUrl } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

const EXPRESS_FEE = 15;

const PAYMENT_METHODS = [
  { key: "card", label: "Credit / debit card" },
  { key: "paypal", label: "PayPal" },
  { key: "cod", label: "Cash on delivery" }
] as const;

export default function CheckoutView() {
  const { cart, hydrated, cartCount, cartTotal } = useShop();
  const [delivery, setDelivery] = useState<"standard" | "express">("standard");
  const [payment, setPayment] = useState<(typeof PAYMENT_METHODS)[number]["key"]>("card");
  const [placed, setPlaced] = useState(false);

  if (!hydrated) return <p className="muted-note">Loading checkout…</p>;

  const lines = cart
    .map(line => ({ line, product: getProduct(line.slug) }))
    .filter(entry => Boolean(entry.product));

  if (lines.length === 0 && !placed) {
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

  if (placed) {
    return (
      <div className="checkout-done">
        <CheckCircle2 size={38} strokeWidth={1.5} />
        <h2>This was a demo checkout</h2>
        <p>
          No payment was taken, no order was submitted and none of your details left this browser —
          Racine IT has no payment or order backend connected yet.
        </p>
        <p className="muted-note">
          Your cart is untouched, so you can go back and review it. Card details are never requested
          on this page.
        </p>
        <div className="checkout-done-actions">
          <Link href="/cart" className="btn-dark">Back to cart</Link>
          <Link href="/shop" className="btn-outline">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      <form
        className="checkout-form"
        onSubmit={event => {
          event.preventDefault();
          if (!event.currentTarget.checkValidity()) {
            event.currentTarget.reportValidity();
            return;
          }
          setPlaced(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
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

        <button type="submit" className="btn-dark checkout-submit">Place order · {formatPrice(total)}</button>
        <p className="checkout-hint">
          Submitting shows a confirmation only. Nothing is ordered, charged or sent anywhere.
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
