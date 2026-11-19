"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, Heart, Home, LayoutGrid, ShoppingBag } from "lucide-react";
import { useShop } from "@/lib/shop-store";

/**
 * Persistent mobile navigation.
 *
 * Categories is a real route (`/categories`), not a drawer or a modal: tapping
 * it navigates to the full-page Categories Hub, which is the primary discovery
 * surface on a phone. The bar is five equal items and keeps clear of the iOS
 * safe area through CSS padding.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlist } = useShop();

  const homeActive = pathname === "/";
  const categoriesActive = pathname.startsWith("/categories");
  const wishlistActive = pathname.startsWith("/wishlist");
  const cartActive = pathname === "/cart" || pathname === "/checkout";
  const accountActive = pathname.startsWith("/account");

  return (
    <nav className="bottom-nav" aria-label="Primary mobile navigation">
      <Link href="/" className={homeActive ? "is-active" : ""} aria-current={homeActive ? "page" : undefined}>
        <Home size={20} />
        <span>Home</span>
      </Link>

      <Link
        href="/categories"
        className={categoriesActive ? "is-active" : ""}
        aria-current={categoriesActive ? "page" : undefined}
      >
        <LayoutGrid size={20} />
        <span>Categories</span>
      </Link>

      <Link
        href="/wishlist"
        className={wishlistActive ? "is-active" : ""}
        aria-current={wishlistActive ? "page" : undefined}
      >
        <span className="nav-icon">
          <Heart size={20} />
          {wishlist.length > 0 && <i aria-hidden>{wishlist.length}</i>}
        </span>
        <span>Wishlist</span>
      </Link>

      <Link href="/cart" className={cartActive ? "is-active" : ""} aria-current={cartActive ? "page" : undefined}>
        <span className="nav-icon">
          <ShoppingBag size={20} />
          {cartCount > 0 && <i aria-hidden>{cartCount}</i>}
        </span>
        <span>Cart{cartCount > 0 ? ` (${cartCount})` : ""}</span>
      </Link>

      <Link href="/account" className={accountActive ? "is-active" : ""} aria-current={accountActive ? "page" : undefined}>
        <CircleUserRound size={20} />
        <span>Account</span>
      </Link>
    </nav>
  );
}
