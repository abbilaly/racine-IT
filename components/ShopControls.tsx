"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS, type SortKey } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

type Props = {
  q: string;
  category: string;
  sort: SortKey;
  total: number;
};

export default function ShopControls({ q, category, sort, total }: Props) {
  const router = useRouter();
  const { categories } = useShop();

  const go = (next: Partial<{ q: string; category: string; sort: SortKey }>) => {
    const params = new URLSearchParams();
    const merged = { q, category, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "featured") params.set("sort", merged.sort);
    const qs = params.toString();
    router.replace(`/shop${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div className="shop-toolbar">
      <div className="shop-cats" role="group" aria-label="Filter by category">
        <button className={category === "" ? "is-on" : ""} onClick={() => go({ category: "" })}>
          All Products
        </button>
        {categories.map(c => (
          <button
            key={c.key}
            className={category === c.key ? "is-on" : ""}
            onClick={() => go({ category: c.key })}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="shop-sort">
        <span>{total} item{total === 1 ? "" : "s"}</span>
        <label>
          Sort by
          <select
            value={sort}
            onChange={e => go({ sort: e.target.value as SortKey })}
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
