"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { formatPrice, imageUrl } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

const MAX_SUGGESTIONS = 6;

export default function SearchBar() {
  const router = useRouter();
  const { searchProducts, categoryLabel } = useShop();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => (query.trim() ? searchProducts(query).slice(0, MAX_SUGGESTIONS) : []),
    [query, searchProducts]
  );
  const totalCount = useMemo(
    () => (query.trim() ? searchProducts(query).length : 0),
    [query, searchProducts]
  );
  // rows: suggestion links first, then the "view all" row
  const rowCount = results.length + (query.trim() ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      if (query.trim()) setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => (i + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => (i <= 0 ? rowCount - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < results.length) {
        go(`/product/${results[active].slug}`);
      } else if (query.trim()) {
        go(`/shop?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <div className="search-field" ref={wrap}>
      <Search size={18} aria-hidden />
      <input
        ref={input}
        type="search"
        value={query}
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls="search-suggestions"
        aria-autocomplete="list"
        aria-label="Search products"
        placeholder="I'm looking for..."
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="search-submit"
        aria-label="Search"
        onClick={() => query.trim() && go(`/shop?q=${encodeURIComponent(query.trim())}`)}
      />

      {open && query.trim() && (
        <div className="search-pop" id="search-suggestions" role="listbox">
          {results.length === 0 && (
            <p className="search-empty">
              No products match “{query.trim()}”. Try “iphone”, “macbook” or “audio”.
            </p>
          )}
          {results.map((p, i) => (
            <Link
              key={p.slug}
              href={`/product/${p.slug}`}
              role="option"
              aria-selected={active === i}
              className={`search-suggestion ${active === i ? "is-active" : ""}`}
              onClick={() => go(`/product/${p.slug}`)}
              onMouseEnter={() => setActive(i)}
            >
              <img src={imageUrl(p.image)} alt="" width={44} height={44} />
              <span className="suggestion-copy">
                <strong>{p.title}</strong>
                <small>{categoryLabel(p.category)}</small>
              </span>
              <b>{formatPrice(p.price)}</b>
            </Link>
          ))}
          {query.trim() && (
            <button
              type="button"
              className={`search-all ${active === results.length ? "is-active" : ""}`}
              onClick={() => go(`/shop?q=${encodeURIComponent(query.trim())}`)}
              onMouseEnter={() => setActive(results.length)}
            >
              See all {totalCount} result{totalCount === 1 ? "" : "s"} for “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
