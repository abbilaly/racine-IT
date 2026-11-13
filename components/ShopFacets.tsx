import Link from "next/link";
import { encodeSpecParam, type FacetGroup } from "@/lib/products";
import {
  activeFilterCount,
  isSelected,
  shopHref,
  shopParams,
  toggleValue,
  type ShopState
} from "@/lib/shop-params";

type Facets = {
  brands: FacetGroup | null;
  colours: FacetGroup | null;
  specs: FacetGroup[];
};

type Props = {
  state: ShopState;
  facets: Facets;
};

/**
 * Server-rendered filter panel.
 *
 * Filters are plain links, so they work without JavaScript, keep the back
 * button meaningful and cost no client state. On mobile the whole panel is a
 * collapsible `<details>` block; on desktop it is always expanded (the summary
 * is hidden by CSS).
 */
export default function ShopFacets({ state, facets }: Props) {
  const active = activeFilterCount(state);

  const brandHref = (value: string) =>
    shopHref({ ...state, brand: toggleValue(state.brand, value), page: 1 });

  const colourHref = (value: string) =>
    shopHref({ ...state, colour: toggleValue(state.colour, value), page: 1 });

  const specHref = (key: string, value: string) => {
    const encoded = encodeSpecParam(key, value);
    return shopHref({ ...state, spec: toggleValue(state.spec, encoded), page: 1 });
  };

  const specSelected = (key: string, value: string) =>
    isSelected(state.spec, encodeSpecParam(key, value));

  const priceFormParams = shopParams({ ...state, min: "", max: "", page: 1 });
  const stockHref = shopHref({ ...state, stock: state.stock === "in" ? "" : "in", page: 1 });
  const ratingHref = shopHref({ ...state, rating: state.rating === "4" ? "" : "4", page: 1 });

  const hasAnyFacet = Boolean(facets.brands || facets.colours || facets.specs.length > 0);

  return (
    <details className="shop-facets" open>
      <summary className="shop-facets-summary">
        <span>Filters</span>
        {active > 0 && <b className="shop-facets-count">{active}</b>}
      </summary>

      <div className="shop-facets-body">
        <div className="facet-group">
          <h3 className="facet-head">Availability</h3>
          <Link
            href={stockHref}
            className={`facet-option${state.stock === "in" ? " is-on" : ""}`}
            aria-pressed={state.stock === "in"}
          >
            <span className="facet-box" aria-hidden="true" />
            In stock only
          </Link>
          <Link
            href={ratingHref}
            className={`facet-option${state.rating === "4" ? " is-on" : ""}`}
            aria-pressed={state.rating === "4"}
          >
            <span className="facet-box" aria-hidden="true" />
            4 stars and up
          </Link>
        </div>

        <form className="facet-group facet-price" action="/shop" method="get">
          <h3 className="facet-head">Price</h3>
          {priceFormParams.map(([name, value], index) => (
            <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
          ))}
          <div className="facet-price-row">
            <label>
              <span>Min</span>
              <input
                type="number"
                name="min"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={state.min}
                placeholder="0"
              />
            </label>
            <label>
              <span>Max</span>
              <input
                type="number"
                name="max"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={state.max}
                placeholder="Any"
              />
            </label>
          </div>
          <button type="submit" className="facet-apply">Apply price</button>
        </form>

        {facets.brands && (
          <div className="facet-group">
            <h3 className="facet-head">{facets.brands.label}</h3>
            {facets.brands.values.map(option => (
              <Link
                key={option.value}
                href={brandHref(option.value)}
                className={`facet-option${isSelected(state.brand, option.value) ? " is-on" : ""}`}
                aria-pressed={isSelected(state.brand, option.value)}
              >
                <span className="facet-box" aria-hidden="true" />
                {option.value}
                <small>{option.count}</small>
              </Link>
            ))}
          </div>
        )}

        {facets.colours && (
          <div className="facet-group">
            <h3 className="facet-head">{facets.colours.label}</h3>
            {facets.colours.values.map(option => (
              <Link
                key={option.value}
                href={colourHref(option.value)}
                className={`facet-option${isSelected(state.colour, option.value) ? " is-on" : ""}`}
                aria-pressed={isSelected(state.colour, option.value)}
              >
                <span className="facet-box" aria-hidden="true" />
                {option.value}
                <small>{option.count}</small>
              </Link>
            ))}
          </div>
        )}

        {facets.specs.map(group => (
          <div className="facet-group" key={group.key}>
            <h3 className="facet-head">{group.label}</h3>
            {group.values.map(option => (
              <Link
                key={option.value}
                href={specHref(group.key, option.value)}
                className={`facet-option${specSelected(group.key, option.value) ? " is-on" : ""}`}
                aria-pressed={specSelected(group.key, option.value)}
              >
                <span className="facet-box" aria-hidden="true" />
                {option.value}
                <small>{option.count}</small>
              </Link>
            ))}
          </div>
        ))}

        {!hasAnyFacet && (
          <p className="facet-empty muted-note">
            No further filters are available for this selection yet.
          </p>
        )}

        {active > 0 && (
          <Link href={shopHref({ ...state, q: "", brand: [], colour: [], spec: [], min: "", max: "", stock: "", rating: "", page: 1 })} className="facet-clear">
            Clear all filters
          </Link>
        )}
      </div>
    </details>
  );
}
