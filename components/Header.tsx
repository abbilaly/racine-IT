"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  CircleUserRound,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  X
} from "lucide-react";
import SearchBar from "./SearchBar";
import { ASSET, formatPrice } from "@/lib/products";
import { useShop } from "@/lib/shop-store";
import { useMobileMenu } from "./MobileMenu";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Products", href: "/shop?sort=rating" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Compare", href: "/compare" },
  { label: "Cart", href: "/cart" },
  { label: "Account", href: "/account" }
];

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const { cartCount, cartTotal, wishlist } = useShop();
  const { open: menuOpen, toggle: toggleMenu } = useMobileMenu();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href.split("?")[0];

  return (
    <>
      <div className="promo-bar">
        <div className="site-shell promo-inner">
          <span>Sign up for 10% off your first order. <b>Sign Up</b></span>
          <span>Summer sale discount off 50%. <b>Shop Sale</b></span>
          <span>Coats—every friday 75% Off. <b>Shop Sale</b></span>
        </div>
      </div>

      <div className="topbar">
        <div className="site-shell topbar-inner">
          <div><a>Help Center</a><a>About Us</a><a>Our Stores</a></div>
          <div><span>🇺🇸 United States (USD $) <ChevronDown size={12} /></span><span>English <ChevronDown size={12} /></span></div>
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
            <Menu />
          </button>

          <Link href="/" className="glozin-logo">
            <img src={`${ASSET}/logo-digital.svg`} alt="Racine IT storefront" />
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
            <button className="account-login"><CircleUserRound /><span>Login<br /><small>Register</small></span></button>
            <Link href="/wishlist" className="round-action account-wishlist" aria-label={`Wishlist with ${wishlist.length} items`}>
              <Heart />
              <i>{wishlist.length}</i>
            </Link>
            <Link href="/cart" className="cart-button" aria-label={`Cart with ${cartCount} items`}>
              <ShoppingBag />
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
          <Link href="/shop" className="recent-link">◷ Recently Viewed Products</Link>
        </div>
      </nav>
    </>
  );
}
