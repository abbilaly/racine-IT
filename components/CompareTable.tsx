"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { formatPrice, imageUrl } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

export default function CompareTable() {
  const { compare, hydrated, toggleCompare, clearCompare, addToCart, getProduct, categoryLabel } =
    useShop();

  if (!hydrated) return <p className="muted-note">Loading comparison…</p>;

  const items = compare.map(getProduct).filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Nothing to compare yet</h2>
        <p>Add up to four products using the compare icon on any product card, then come back here.</p>
        <Link href="/shop" className="btn-dark">Browse products</Link>
      </div>
    );
  }

  // Union of spec labels across the selected products, in first-seen order.
  const specRows: string[] = [];
  for (const p of items) {
    for (const [term] of p!.specs) {
      if (!specRows.includes(term)) specRows.push(term);
    }
  }

  const valueFor = (slug: string, term: string) =>
    getProduct(slug)?.specs.find(([t]) => t === term)?.[1] ?? "—";

  const rows: { label: string; render: (slug: string) => React.ReactNode }[] = [
    { label: "Price", render: slug => <strong className="compare-price">{formatPrice(getProduct(slug)!.price)}</strong> },
    {
      label: "Regular price",
      render: slug => getProduct(slug)!.oldPrice ? <del>{formatPrice(getProduct(slug)!.oldPrice!)}</del> : "—"
    },
    {
      label: "Rating",
      render: slug => (
        <span>
          <span className="rating">★★★★★</span>{" "}
          <small>{getProduct(slug)!.rating}.0 ({getProduct(slug)!.reviews})</small>
        </span>
      )
    },
    { label: "Category", render: slug => categoryLabel(getProduct(slug)!.category) },
    {
      label: "Availability",
      render: slug => {
        const stock = getProduct(slug)!.stock;
        return stock > 0 ? `${stock} in stock` : "Out of stock";
      }
    },
    ...specRows.map(term => ({ label: term, render: (slug: string) => valueFor(slug, term) }))
  ];

  return (
    <>
      <div className="compare-head">
        <p>{items.length} of 4 products selected</p>
        <button className="tray-clear" onClick={clearCompare}>Clear all</button>
      </div>

      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="row-label">Product</th>
              {items.map(p => (
                <th key={p!.slug} scope="col">
                  <button
                    className="compare-remove"
                    aria-label={`Remove ${p!.title} from compare`}
                    onClick={() => toggleCompare(p!.slug)}
                  >
                    <X size={13} />
                  </button>
                  <Link href={`/product/${p!.slug}`}>
                    <img src={imageUrl(p!.image)} alt={p!.title} />
                    <span>{p!.title}</span>
                  </Link>
                  <button className="btn-dark compare-add" onClick={() => addToCart(p!.slug)}>
                    Add to Cart
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <th scope="row" className="row-label">{row.label}</th>
                {items.map(p => <td key={p!.slug}>{row.render(p!.slug)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
