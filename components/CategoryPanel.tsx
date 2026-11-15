"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { categoryIcon } from "@/lib/category-icons";
import { useShop } from "@/lib/shop-store";
import { formatPrice, imageUrl } from "@/lib/products";

/**
 * Product Categories sidebar.
 *
 * A rebuild of the Glozin Electro Pulse "Product Categories" navigation:
 * a 60px icon rail pinned to the left of the viewport that expands into a
 * 280px panel on hover/click, dims the page behind a 50% black backdrop and
 * reveals each category's subcategories in a flyout panel that opens to the
 * right of the panel. The rail is desktop-only; below 1025px the storefront's
 * existing mobile menu keeps handling category navigation.
 */

/** Icons come from the shared slug map, so the rail covers every category. */

/** Matches the reference: six links per column at most. */
const MAX_LINKS = 6;

export default function CategoryPanel() {
  const { categories, products } = useShop();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverOpenedAt = useRef(0);

  const items = useMemo(
    () =>
      categories.map(cat => {
        const list = products.filter(p => p.category === cat.key);
        return {
          key: cat.key,
          label: cat.label,
          href: `/shop?category=${cat.key}`,
          links: list.slice(0, MAX_LINKS),
          promo: list[0]
        };
      }),
    [categories, products]
  );

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen(v => !v), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={`gz-cats${open ? " opened" : ""}`}
    >
      {/* Dark overlay behind the open panel. */}
      <div className="gz-cats__backdrop" aria-hidden="true" onClick={close} />

      <div className="gz-cats__container" onMouseLeave={close}>
        <button
          type="button"
          className="gz-cats__header"
          aria-expanded={open}
          aria-controls="product-categories-nav"
          aria-label={open ? "Hide product categories" : "Show product categories"}
          onMouseEnter={() => {
            hoverOpenedAt.current = Date.now();
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => {
            // Touch screens fire mouseenter right before click; keep the panel
            // open in that case instead of toggling it straight back closed.
            if (open && Date.now() - hoverOpenedAt.current < 400) return;
            toggle();
          }}
        >
          <Menu size={18} strokeWidth={2} className="gz-cats__header-icon" aria-hidden="true" />
          <span className="gz-cats__header-text">Product Categories</span>
        </button>

        <nav className="gz-cats__nav" id="product-categories-nav" aria-label="Product categories">
          <ul className="gz-cats__list">
            {items.map(item => {
              const Icon = categoryIcon(item.key);
              const others = items.filter(other => other.key !== item.key);
              return (
                <li className="gz-cats__item" key={item.key}>
                  <Link className="gz-cats__row" href={item.href} onClick={close}>
                    <span className="gz-cats__icon" aria-hidden="true">
                      <Icon size={24} strokeWidth={1.5} />
                    </span>
                    <span className="gz-cats__text">{item.label}</span>
                  </Link>

                  <div className="gz-cats__flyout">
                    <div className="gz-cats__flyout-inner">
                      <div className="gz-cats__col">
                        <span className="gz-cats__col-head">{item.label}</span>
                        <ul className="gz-cats__links">
                          {item.links.map(product => (
                            <li key={product.slug}>
                              <Link href={`/product/${product.slug}`} onClick={close}>
                                {product.title}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link href={item.href} onClick={close}>
                              Shop all {item.label}
                            </Link>
                          </li>
                        </ul>
                      </div>

                      <div className="gz-cats__col gz-cats__col--explore">
                        <span className="gz-cats__col-head">Explore Categories</span>
                        <ul className="gz-cats__links">
                          {others.map(other => (
                            <li key={other.key}>
                              <Link href={other.href} onClick={close}>
                                {other.label}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link href="/shop" onClick={close}>
                              All Products
                            </Link>
                          </li>
                        </ul>
                      </div>

                      {item.promo && (
                        <Link
                          className="gz-cats__promo"
                          href={`/product/${item.promo.slug}`}
                          onClick={close}
                        >
                          <span className="gz-cats__promo-eyebrow">AB Tech</span>
                          <strong className="gz-cats__promo-title">{item.promo.title}</strong>
                          <span className="gz-cats__promo-price">
                            Just from: <b>{formatPrice(item.promo.price)}</b>
                          </span>
                          <span className="gz-cats__promo-btn">Shop Now</span>
                          <img
                            className="gz-cats__promo-img"
                            src={imageUrl(item.promo.image)}
                            alt=""
                            loading="lazy"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
