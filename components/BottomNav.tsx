"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, Home, LayoutGrid, ShoppingBag } from "lucide-react";
import { useShop } from "@/lib/shop-store";
import { useMobileMenu } from "./MobileMenu";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount } = useShop();
  const { open, setOpen } = useMobileMenu();

  const homeActive = pathname === "/";
  const cartActive = pathname === "/cart" || pathname === "/checkout";
  const accountActive = pathname.startsWith("/account");

  return (
    <nav className="bottom-nav" aria-label="Primary mobile navigation">
      <Link href="/" className={homeActive ? "is-active" : ""} aria-current={homeActive ? "page" : undefined}>
        <Home size={20} />
        <span>Home</span>
      </Link>

      <button
        className={open ? "is-active" : ""}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
      >
        <LayoutGrid size={20} />
        <span>Categories</span>
      </button>

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
