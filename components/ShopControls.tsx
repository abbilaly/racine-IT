"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS, type SortKey } from "@/lib/products";
import { shopHref, type ShopState } from "@/lib/shop-params";
import { useShop } from "@/lib/shop-store";

type Props = {
  state: ShopState;
  total: number;
};

/**
 * Shop toolbar: category pills and sorting.
 *
 * Every navigation is built from the full shop state, so changing the category
 * or the sort order keeps the active brand/price/technical filters instead of
 * silently dropping them. Changing either resets pagination to page 1.
 */
export default function ShopControls({ state, total }: Props) {
  const router = useRouter();
  const { categories } = useShop();

  const navigate = (next: Partial<ShopState>) => {
    router.replace(shopHref({ ...state, ...next, page: 1 }), { scroll: false });
  };

  return (
    <div className="shop-toolbar">
      <div className="shop-cats" role="group" aria-label="Filter by category">
        <button
          type="button"
          className={state.category === "" ? "is-on" : ""}
          aria-pressed={state.category === ""}
          onClick={() => navigate({ category: "" })}
        >
          All Products
        </button>
        {categories.map(c => (
          <button
            key={c.key}
            type="button"
            className={state.category === c.key ? "is-on" : ""}
            aria-pressed={state.category === c.key}
            onClick={() => navigate({ category: c.key })}
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
            value={state.sort}
            onChange={e => navigate({ sort: e.target.value as SortKey })}
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
