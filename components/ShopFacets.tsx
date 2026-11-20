"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  colourHex,
  parseSpecParam,
  type FacetGroup,
  type ShopFacets as Facets
} from "@/lib/products";
import { formatMoney } from "@/lib/currency";
import {
  activeFilterCount,
  isSelected,
  shopHref,
  toggleValue,
  type ShopState
} from "@/lib/shop-params";

type CategoryCount = { key: string; label: string; count: number };

type Props = {
  state: ShopState;
  facets: Facets;
  categories: CategoryCount[];
  total: number;
  /** ISO currency code the catalogue is priced in. */
  currency: string;
};

const money = (value: number, currency: string) =>
  formatMoney(value, currency, { fractionDigits: 0 });

function humanise(key: string): string {
  const text = key.replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : key;
}

/**
 * Shop filter sidebar.
 *
 * Every filter is written to the URL by the client, so results stay shareable
 * and the server renders the filtered page — no catalogue re-query per filter.
 * On phones and tablets the same panel opens as a drawer instead of squeezing
 * the desktop sidebar onto the screen.
 */
export default function ShopFacets({ state, facets, categories, total, currency }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = activeFilterCount(state);

  const apply = (next: Partial<ShopState>) => {
    router.replace(shopHref({ ...state, ...next, page: 1 }), { scroll: false });
  };

  const clearAll = () =>
    router.replace(
      shopHref({
        ...state,
        q: "",
        category: "",
        brand: [],
        colour: [],
        connectivity: [],
        warranty: [],
        origin: [],
        spec: [],
        min: "",
        max: "",
        stock: "",
        sale: "",
        rating: "",
        page: 1
      }),
      { scroll: false }
    );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const body = (
    <FacetSections
      state={state}
      facets={facets}
      categories={categories}
      total={total}
      currency={currency}
      active={active}
      apply={apply}
      clearAll={clearAll}
    />
  );

  return (
    <>
      <div className="shop-sidebar">
        <button
          type="button"
          className="shop-filter-trigger"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span>Filters</span>
          {active > 0 && <b className="filter-badge">{active}</b>}
        </button>

        <aside className="shop-facets" aria-label="Product filters">
          <div className="shop-facets-head">Filters</div>
          <div className="shop-facets-body">{body}</div>
        </aside>
      </div>

      {open && (
        <div className="filter-drawer" role="dialog" aria-modal="true" aria-label="Product filters">
          <button
            type="button"
            className="filter-drawer-backdrop"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          />
          <div className="filter-drawer-panel">
            <div className="filter-drawer-head">
              <span>Filters{active > 0 ? ` (${active})` : ""}</span>
              <button
                ref={closeRef}
                type="button"
                className="filter-drawer-close"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="filter-drawer-body">
              {body}
              <button type="button" className="filter-drawer-done" onClick={() => setOpen(false)}>
                Show {total} product{total === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FacetSections({
  state,
  facets,
  categories,
  total,
  currency,
  active,
  apply,
  clearAll
}: {
  state: ShopState;
  facets: Facets;
  categories: CategoryCount[];
  currency: string;
  total: number;
  active: number;
  apply: (next: Partial<ShopState>) => void;
  clearAll: () => void;
}) {
  const allCount = categories.reduce((sum, category) => sum + category.count, 0);
  const categoryName = state.category
    ? categories.find(category => category.key === state.category)?.label ?? humanise(state.category)
    : "";

  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (state.category) {
    chips.push({ key: "category", label: categoryName, clear: () => apply({ category: "" }) });
  }
  if (state.q) {
    chips.push({ key: "q", label: `“${state.q}”`, clear: () => apply({ q: "" }) });
  }
  if (state.sale === "1") {
    chips.push({ key: "sale", label: "On sale", clear: () => apply({ sale: "" }) });
  }
  if (state.stock === "in") {
    chips.push({ key: "stock", label: "In stock", clear: () => apply({ stock: "" }) });
  }
  if (state.min || state.max) {
    const label =
      state.min && state.max
        ? `${money(Number(state.min), currency)} – ${money(Number(state.max), currency)}`
        : state.min
          ? `From ${money(Number(state.min), currency)}`
          : `Up to ${money(Number(state.max), currency)}`;
    chips.push({ key: "price", label, clear: () => apply({ min: "", max: "" }) });
  }
  if (state.rating) {
    chips.push({
      key: "rating",
      label: `${state.rating}★ & up`,
      clear: () => apply({ rating: "" })
    });
  }
  for (const value of state.colour) {
    chips.push({
      key: `colour:${value}`,
      label: value,
      clear: () => apply({ colour: toggleValue(state.colour, value) })
    });
  }
  for (const value of state.brand) {
    chips.push({
      key: `brand:${value}`,
      label: value,
      clear: () => apply({ brand: toggleValue(state.brand, value) })
    });
  }
  for (const value of state.connectivity) {
    chips.push({
      key: `connectivity:${value}`,
      label: value,
      clear: () => apply({ connectivity: toggleValue(state.connectivity, value) })
    });
  }
  for (const value of state.warranty) {
    chips.push({
      key: `warranty:${value}`,
      label: `${value} warranty`,
      clear: () => apply({ warranty: toggleValue(state.warranty, value) })
    });
  }
  for (const value of state.origin) {
    chips.push({
      key: `origin:${value}`,
      label: value,
      clear: () => apply({ origin: toggleValue(state.origin, value) })
    });
  }
  // Technical filters can still arrive from older shared links even though the
  // sidebar no longer offers them, so they stay visible and removable.
  for (const value of state.spec) {
    const parsed = parseSpecParam(value);
    if (!parsed) continue;
    chips.push({
      key: `spec:${value}`,
      label: `${parsed.key}: ${parsed.value}`,
      clear: () => apply({ spec: toggleValue(state.spec, value) })
    });
  }

  return (
    <>
      <div className="facet-status">
        <span>
          <b>{total}</b> product{total === 1 ? "" : "s"}
        </span>
        {active > 0 && (
          <button type="button" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="facet-active" aria-label="Active filters">
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              className="active-chip"
              onClick={chip.clear}
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <X size={11} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <Section title="Categories">
        <ul className="facet-list">
          <li>
            <button
              type="button"
              className={`facet-row${state.category === "" ? " is-on" : ""}`}
              aria-pressed={state.category === ""}
              onClick={() => apply({ category: "" })}
            >
              <span className="facet-check" aria-hidden="true" />
              <span className="facet-label">All Products</span>
              <span className="facet-count">{allCount}</span>
            </button>
          </li>
          {categories.map(category => {
            const on = state.category === category.key;
            return (
              <li key={category.key}>
                <button
                  type="button"
                  className={`facet-row${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => apply({ category: on ? "" : category.key })}
                >
                  <span className="facet-check" aria-hidden="true" />
                  <span className="facet-label">{category.label}</span>
                  <span className="facet-count">{category.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Availability">
        <div className="facet-list">
          <button
            type="button"
            className={`facet-row${state.sale === "1" ? " is-on" : ""}`}
            aria-pressed={state.sale === "1"}
            onClick={() => apply({ sale: state.sale === "1" ? "" : "1" })}
          >
            <span className="facet-check" aria-hidden="true" />
            <span className="facet-label">On sale</span>
            <span className="facet-count">{facets.availability.onSale}</span>
          </button>
          <button
            type="button"
            className={`facet-row${state.stock === "in" ? " is-on" : ""}`}
            aria-pressed={state.stock === "in"}
            onClick={() => apply({ stock: state.stock === "in" ? "" : "in" })}
          >
            <span className="facet-check" aria-hidden="true" />
            <span className="facet-label">In stock</span>
            <span className="facet-count">{facets.availability.inStock}</span>
          </button>
        </div>
      </Section>

      <Section title="Price">
        <PriceSection state={state} bounds={facets.price} apply={apply} currency={currency} />
      </Section>

      <Section title="Color">
        {facets.colours ? (
          <div className="facet-swatches">
            {facets.colours.values.map(option => {
              const on = isSelected(state.colour, option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`colour-swatch${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  aria-label={`${option.value}, ${option.count} product${option.count === 1 ? "" : "s"}`}
                  title={`${option.value} (${option.count})`}
                  onClick={() => apply({ colour: toggleValue(state.colour, option.value) })}
                >
                  <span
                    className="colour-dot"
                    style={{ backgroundColor: colourHex(option.value) }}
                    aria-hidden="true"
                  />
                  <span className="colour-name">{option.value}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="facet-note">No colour data is recorded for these products yet.</p>
        )}
      </Section>

      <Section title="Brand">
        {facets.brands ? (
          <Chips
            group={facets.brands}
            selected={state.brand}
            onToggle={value => apply({ brand: toggleValue(state.brand, value) })}
          />
        ) : (
          <p className="facet-note">No brands are recorded in the catalogue yet.</p>
        )}
      </Section>

      <Section title="Connectivity">
        {facets.connectivity ? (
          <Chips
            group={facets.connectivity}
            selected={state.connectivity}
            onToggle={value => apply({ connectivity: toggleValue(state.connectivity, value) })}
          />
        ) : (
          <p className="facet-note">No connectivity data is recorded for these products yet.</p>
        )}
      </Section>

      <Section title="Warranty">
        {facets.warranty ? (
          <Chips
            group={facets.warranty}
            selected={state.warranty}
            onToggle={value => apply({ warranty: toggleValue(state.warranty, value) })}
          />
        ) : (
          <p className="facet-note">No warranty data is recorded for these products yet.</p>
        )}
      </Section>

      <Section title="Origin">
        {facets.origin ? (
          <Chips
            group={facets.origin}
            selected={state.origin}
            onToggle={value => apply({ origin: toggleValue(state.origin, value) })}
          />
        ) : (
          <p className="facet-note">Origin is not recorded for these products yet.</p>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <details
      className="facet-section"
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary className="facet-section-head">
        <span>{title}</span>
        <ChevronDown className="facet-caret" size={13} aria-hidden="true" />
      </summary>
      <div className="facet-section-body">{children}</div>
    </details>
  );
}

function Chips({
  group,
  selected,
  onToggle
}: {
  group: FacetGroup;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="facet-chips">
      {group.values.map(option => {
        const on = isSelected(selected, option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`facet-chip${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
          >
            <span>{option.value}</span>
            <span className="chip-count">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function PriceSection({
  state,
  bounds,
  apply,
  currency
}: {
  state: ShopState;
  bounds: { min: number; max: number };
  apply: (next: Partial<ShopState>) => void;
  currency: string;
}) {
  const clamp = (value: number) =>
    Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(value) ? value : bounds.min));

  const [min, setMin] = useState(bounds.min);
  const [max, setMax] = useState(bounds.max);
  const [minText, setMinText] = useState(String(bounds.min));
  const [maxText, setMaxText] = useState(String(bounds.max));

  useEffect(() => {
    const lo = clamp(state.min ? Number(state.min) : bounds.min);
    const hi = clamp(state.max ? Number(state.max) : bounds.max);
    setMin(lo);
    setMax(Math.max(lo, hi));
    setMinText(String(Math.round(lo)));
    setMaxText(String(Math.round(Math.max(lo, hi))));
    // `clamp` is derived from bounds, which are listed explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.min, state.max, bounds.min, bounds.max]);

  const commit = (lo: number, hi: number) => {
    const orderedMin = Math.round(Math.max(bounds.min, Math.min(lo, hi)));
    const orderedMax = Math.round(Math.min(bounds.max, Math.max(lo, hi)));
    apply({
      min: orderedMin <= bounds.min ? "" : String(orderedMin),
      max: orderedMax >= bounds.max ? "" : String(orderedMax)
    });
  };

  const onRangeMin = (value: number) => {
    const next = Math.min(value, max);
    setMin(next);
    setMinText(String(next));
  };

  const onRangeMax = (value: number) => {
    const next = Math.max(value, min);
    setMax(next);
    setMaxText(String(next));
  };

  const span = bounds.max - bounds.min || 1;
  const fillLeft = ((min - bounds.min) / span) * 100;
  const fillRight = 100 - ((max - bounds.min) / span) * 100;

  const commitText = () => {
    const lo = minText.trim() === "" ? bounds.min : Number(minText);
    const hi = maxText.trim() === "" ? bounds.max : Number(maxText);
    commit(clamp(lo), clamp(hi));
  };

  return (
    <>
      <div className="facet-price-fields">
        <label>
          <span>Min</span>
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={minText}
            aria-label="Minimum price"
            onChange={event => {
              setMinText(event.target.value);
              if (event.target.value !== "") setMin(clamp(Number(event.target.value)));
            }}
            onBlur={commitText}
            onKeyDown={event => {
              if (event.key === "Enter") commitText();
            }}
          />
        </label>
        <span className="facet-price-sep" aria-hidden="true">
          —
        </span>
        <label>
          <span>Max</span>
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={maxText}
            aria-label="Maximum price"
            onChange={event => {
              setMaxText(event.target.value);
              if (event.target.value !== "") setMax(clamp(Number(event.target.value)));
            }}
            onBlur={commitText}
            onKeyDown={event => {
              if (event.key === "Enter") commitText();
            }}
          />
        </label>
      </div>

      <div className="price-slider">
        <div className="price-track" aria-hidden="true" />
        <div
          className="price-fill"
          style={{ left: `${fillLeft}%`, right: `${fillRight}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          className="price-range price-range-min"
          min={bounds.min}
          max={bounds.max}
          step={1}
          value={min}
          style={{ zIndex: min === max ? 3 : 2 }}
          aria-label="Minimum price slider"
          onChange={event => onRangeMin(Number(event.target.value))}
          onPointerUp={() => commit(min, max)}
          onTouchEnd={() => commit(min, max)}
          onKeyUp={() => commit(min, max)}
        />
        <input
          type="range"
          className="price-range price-range-max"
          min={bounds.min}
          max={bounds.max}
          step={1}
          value={max}
          aria-label="Maximum price slider"
          onChange={event => onRangeMax(Number(event.target.value))}
          onPointerUp={() => commit(min, max)}
          onTouchEnd={() => commit(min, max)}
          onKeyUp={() => commit(min, max)}
        />
      </div>

      <p className="price-readout">
        Price: <b>{money(min, currency)}</b> — <b>{money(max, currency)}</b>
      </p>
    </>
  );
}
