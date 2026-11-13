import Link from "next/link";
import { PAYMENTS, type CategoryOption } from "@/lib/products";
import { BRAND, CONTACT, STORE_BLURB } from "@/lib/site-config";

/**
 * Category links come from the loaded catalogue rather than a hardcoded list, so
 * the footer can only ever link to a category that exists right now (the live
 * taxonomy is still the pre-0007 one). Without a catalogue we fall back to the
 * generic routes instead of linking to filters that return nothing.
 */
export default function Footer({ categories = [] }: { categories?: readonly CategoryOption[] }) {
  const shopLinks = categories.slice(0, 6);
  return (
    <footer className="footer">
      <div className="site-shell footer-grid">
        <div className="support-column">
          <span>HELP CENTER</span>
          <h2>Customer Support</h2>
          <p><b>Email us</b><br />{CONTACT.email}</p>
          <p><b>Call us</b><br />{CONTACT.phone}</p>
          <p className="muted-note">{CONTACT.disclaimer}</p>
        </div>
        <div>
          <h3>About {BRAND}</h3>
          <p>{STORE_BLURB}</p>
          <p>{CONTACT.email}</p>
        </div>
        <div>
          <h3>Customer Service</h3>
          <Link href="/shop">Shop all products</Link>
          <Link href="/cart">Your cart</Link>
          <Link href="/checkout">Checkout</Link>
          <Link href="/account">Track your order</Link>
          <Link href="/wishlist">Wishlist</Link>
          <Link href="/compare">Compare products</Link>
        </div>
        <div>
          <h3>Shop Categories</h3>
          <Link href="/shop?sort=discount">Hot Deals</Link>
          <Link href="/shop?sort=rating">Best Seller</Link>
          {shopLinks.length > 0 ? (
            shopLinks.map(category => (
              <Link key={category.key} href={`/shop?category=${encodeURIComponent(category.key)}`}>
                {category.label}
              </Link>
            ))
          ) : (
            <Link href="/shop">All products</Link>
          )}
        </div>
      </div>
      <div className="site-shell footer-legal">
        <Link href="/about">About {BRAND}</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/shipping">Shipping</Link>
        <Link href="/returns">Returns</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms of sale</Link>
      </div>
      <div className="site-shell footer-bottom">
        <span>© 2026 {BRAND}. All Rights Reserved.</span>
        <img src={PAYMENTS} alt="Accepted payment methods" />
      </div>
    </footer>
  );
}