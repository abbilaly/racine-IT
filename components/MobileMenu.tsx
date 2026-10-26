"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { ChevronRight, X } from "lucide-react";
import { useShop } from "@/lib/shop-store";

type MenuContextValue = { open: boolean; setOpen: (value: boolean) => void; toggle: () => void };

const MenuContext = createContext<MenuContextValue | null>(null);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);
  return <MenuContext.Provider value={{ open, setOpen, toggle }}>{children}</MenuContext.Provider>;
}

export function useMobileMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMobileMenu must be used inside <MobileMenuProvider>");
  return ctx;
}

const QUICK_LINKS: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "All Products", href: "/shop" },
  { label: "Sale & Offers", href: "/shop?sort=discount" },
  { label: "Top Rated", href: "/shop?sort=rating" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Compare Products", href: "/compare" },
  { label: "Cart", href: "/cart" },
  { label: "Account", href: "/account" }
];

export function MobileMenu() {
  const { open, setOpen } = useMobileMenu();
  const { categories } = useShop();
  const pathname = usePathname();
  const closeBtn = useRef<HTMLButtonElement>(null);

  // close whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // lock background scroll and support Escape while open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className={`menu-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="menu-scrim" tabIndex={open ? 0 : -1} aria-label="Close menu" onClick={() => setOpen(false)} />
      <aside id="mobile-menu" className="menu-sheet" role="dialog" aria-modal="true" aria-label="Site menu">
        <div className="menu-sheet-head">
          <strong>Menu</strong>
          <button ref={closeBtn} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="menu-sheet-body">
          <p className="menu-group-label">Browse</p>
          <ul className="menu-quick">
            {QUICK_LINKS.map(link => (
              <li key={link.href}>
                <Link href={link.href} tabIndex={open ? 0 : -1}>
                  {link.label}
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
          </ul>

          <p className="menu-group-label">Product Categories</p>
          <ul className="menu-cats">
            {categories.map(cat => (
              <li key={cat.key}>
                <Link href={`/shop?category=${cat.key}`} tabIndex={open ? 0 : -1}>
                  {cat.label}
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop" tabIndex={open ? 0 : -1}>
                All Products
                <ChevronRight size={14} />
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
