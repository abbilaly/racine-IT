"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  LogOut,
  User,
  X
} from "lucide-react";
import SearchBar from "./SearchBar";
import { formatPrice } from "@/lib/products";
import { useShop } from "@/lib/shop-store";
import { useMobileMenu } from "./MobileMenu";
import { BRAND } from "@/lib/site-config";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Products", href: "/shop?sort=rating" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Compare", href: "/compare" },
  { label: "Cart", href: "/cart" },
  { label: "Account", href: "/account" },
];

interface CustomerSession {
  userId: string;
  email: string;
}

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const { cartCount, cartTotal, wishlist } = useShop();
  const { open: menuOpen, toggle: toggleMenu } = useMobileMenu();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setSession(data?.customer ? { userId: data.customer.id, email: data.customer.email } : null);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href.split("?")[0];

  return (
    <>
      <div className="promo-bar">
        <div className="site-shell promo-inner">
          <span>Welcome to {BRAND}.</span>
          <span>Shop laptops, phones, tablets and audio.</span>
          <span>Guest checkout — no account needed.</span>
        </div>
      </div>

      <div className="topbar">
        <div className="site-shell topbar-inner">
          <div><span>United States (USD $)</span></div>
        </div>
      </div>

      <header className={`main-header ${searchOpen ? "search-open" : ""}`}>
        <div className="site-shell header-inner">
          <button
            className="mobile-menu-button"
            onClick={toggleMenu}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <Menu size={20} strokeWidth={1.7} />
          </button>

          <Link href="/" className="site-wordmark" aria-label={`${BRAND} home`}>
            {BRAND}
          </Link>

          <SearchBar />

          <button
            className="mobile-search-button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(v => !v)}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>

          <div className="account-area">
            {loading ? (
              <Link href="/account" className="account-login loading" aria-label="Account">
                <CircleUserRound size={20} strokeWidth={1.6} className="spinner" />
              </Link>
            ) : session ? (
              <>
                <Link href="/account/profile" className="account-login signed-in" aria-label="My Account">
                  <User size={20} strokeWidth={1.6} />
                  <span>My Account<br /><small>{session.email}</small></span>
                </Link>
                <form
                  method="POST"
                  action="/api/auth/signout"
                  className="account-sign-out-inline"
                  onClick={e => e.preventDefault()}
                  onSubmit={e => e.preventDefault()}
                >
                  <button
                    type="button"
                    className="btn-text account-sign-out-chip"
                    onClick={() => {
                      fetch("/api/auth/signout", { method: "POST" }).then(() => {
                        setSession(null);
                        window.location.reload();
                      });
                    }}
                  >
                    <LogOut size={16} strokeWidth={1.7} />
                  </button>
                </form>
              </>
            ) : (
              <Link href="/account" className="account-login" aria-label="Account">
                <CircleUserRound size={20} strokeWidth={1.6} />
                <span>Account<br /><small>Guest session</small></span>
              </Link>
            )}
            <Link href="/wishlist" className="round-action account-wishlist" aria-label={`Wishlist with ${wishlist.length} items`}>
              <Heart size={18} strokeWidth={1.6} />
              <i>{wishlist.length}</i>
            </Link>
            <Link href="/cart" className="cart-button" aria-label={`Cart with ${cartCount} items`}>
              <ShoppingBag size={18} strokeWidth={1.6} />
              <i>{cartCount}</i>
              <span>Cart<br /><small>{formatPrice(cartTotal)}</small></span>
            </Link>
          </div>
        </div>
      </header>

      <nav className="main-nav">
        <div className="site-shell nav-inner">
          <div className="nav-links">
            {NAV.map(item => (
              <Link key={item.label} href={item.href} className={isActive(item.href) ? "active" : ""}>
                {item.label}
              </Link>
            ))}
            <Link href="/shop?sort=discount" className="sale-nav">Sale <b>HOT</b></Link>
          </div>
        </div>
      </nav>
    </>
  );
}
