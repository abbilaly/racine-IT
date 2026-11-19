"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, LayoutGrid, Search, X } from "lucide-react";
import { categoryIcon } from "@/lib/category-icons";

export type HubCategory = {
  key: string;
  label: string;
  count: number;
  image: string;
  description: string;
  /** Real child categories from the database hierarchy (empty when flat). */
  children: { key: string; label: string; count: number }[];
  /** Brands actually present in this category, most stocked first. */
  brands: string[];
  /** Operator-chosen icon key, when the category records one. */
  iconKey?: string | null;
};

/**
 * Full-page category discovery.
 *
 * This is the destination of the mobile "Categories" tab, so it has to work as
 * a page: a search field that filters as you type, real categories from the
 * database with real product counts, and direct links into the filtered shop
 * (which keeps every existing filter, sort and pagination behaviour).
 */
export default function CategoriesHub({
  categories,
  totalProducts
}: {
  categories: HubCategory[];
  totalProducts: number;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return categories;
    return categories.filter(category => {
      const haystack = [
        category.label,
        category.description,
        ...category.children.map(child => child.label),
        ...category.brands
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [categories, term]);

  return (
    <div className="hub">
      <header className="hub-hero">
        <span className="hub-kicker">AB Tech catalogue</span>
        <h1>Explore Categories</h1>
        <p>
          {totalProducts} product{totalProducts === 1 ? "" : "s"} across{" "}
          {categories.length} categor{categories.length === 1 ? "y" : "ies"}. Pick a category to
          see its products, filters and specifications.
        </p>

        <form className="hub-search" role="search" onSubmit={event => event.preventDefault()}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search categories, e.g. laptops, gaming or printers"
            aria-label="Search categories"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear category search">
              <X size={16} />
            </button>
          )}
        </form>
      </header>

      {filtered.length === 0 ? (
        <div className="hub-empty">
          <LayoutGrid size={22} aria-hidden="true" />
          <h2>No category matches “{query.trim()}”</h2>
          <p>Try a shorter word, or browse the full catalogue instead.</p>
          <div className="hub-empty-actions">
            <button type="button" className="btn-dark" onClick={() => setQuery("")}>
              Clear search
            </button>
            <Link href="/shop" className="btn-ghost">
              Browse all products
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="hub-section-head">
            <h2>{term ? `${filtered.length} matching categor${filtered.length === 1 ? "y" : "ies"}` : "All categories"}</h2>
            <Link href="/shop">View the full catalogue <ChevronRight size={14} /></Link>
          </div>

          <ul className="hub-grid">
            {filtered.map(category => {
              const Icon = categoryIcon(category.key, category.iconKey);
              return (
              <li className="hub-card" key={category.key}>
                <Link href={`/shop?category=${category.key}`} className="hub-card-main">
                  {/* Only real catalogue imagery is used. A category without a
                      product photo or a banner shows its branded icon tile
                      instead of an unrelated stock picture. */}
                  {category.image ? (
                    <span className="hub-card-media">
                      <img src={category.image} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <span className="hub-card-media hub-card-media--icon">
                      <Icon aria-hidden="true" />
                    </span>
                  )}
                  <span className="hub-card-body">
                    <span className="hub-card-title">{category.label}</span>
                    <span className="hub-card-count">
                      {category.count} product{category.count === 1 ? "" : "s"}
                    </span>
                    <span className="hub-card-desc">{category.description}</span>
                    <span className="hub-card-cta">
                      Shop {category.label} <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </span>
                </Link>

                {(category.children.length > 0 || category.brands.length > 0) && (
                  <div className="hub-card-links">
                    {category.children.length > 0 ? (
                      category.children.slice(0, 4).map(child => (
                        <Link key={child.key} href={`/shop?category=${child.key}`}>
                          {child.label}
                          <small>{child.count}</small>
                        </Link>
                      ))
                    ) : (
                      category.brands.slice(0, 4).map(brand => (
                        <Link
                          key={brand}
                          href={`/shop?category=${category.key}&brand=${encodeURIComponent(brand)}`}
                        >
                          {brand}
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
