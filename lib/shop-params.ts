/**
 * Shop query state.
 *
 * Every filter lives in the URL so results are shareable, the back button works
 * and the server can render the whole filtered page without client state. This
 * module is deliberately dependency-free so both the server page and the client
 * controls can build the same links.
 */

export type ShopState = {
  q: string;
  category: string;
  sort: string;
  brand: string[];
  colour: string[];
  /** Connectivity standards such as Wi-Fi or Bluetooth. */
  connectivity: string[];
  /** Warranty terms recorded in the catalogue. */
  warranty: string[];
  /** Country of origin, once the catalogue records it. */
  origin: string[];
  /** Technical filters encoded as `Key::Value`. */
  spec: string[];
  min: string;
  max: string;
  /** "in" means in-stock only. */
  stock: string;
  /** "1" means discounted products only. */
  sale: string;
  rating: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

function many(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(v => v.trim()).filter(Boolean))];
}

/** Reads a validated, normalised shop state from Next's `searchParams`. */
export function readShopState(sp: RawParams): ShopState {
  const parsedPage = Number.parseInt(one(sp.page), 10);
  return {
    q: one(sp.q),
    category: one(sp.category),
    sort: one(sp.sort),
    brand: many(sp.brand),
    colour: many(sp.colour),
    connectivity: many(sp.connectivity),
    warranty: many(sp.warranty),
    origin: many(sp.origin),
    spec: many(sp.spec),
    min: one(sp.min),
    max: one(sp.max),
    stock: one(sp.stock),
    sale: one(sp.sale),
    rating: one(sp.rating),
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  };
}

/** Serialises the state as ordered query pairs (empty values are dropped). */
export function shopParams(state: ShopState): [string, string][] {
  const params: [string, string][] = [];
  if (state.q) params.push(["q", state.q]);
  if (state.category) params.push(["category", state.category]);
  if (state.sort && state.sort !== "featured") params.push(["sort", state.sort]);
  for (const value of state.brand) params.push(["brand", value]);
  for (const value of state.colour) params.push(["colour", value]);
  for (const value of state.connectivity) params.push(["connectivity", value]);
  for (const value of state.warranty) params.push(["warranty", value]);
  for (const value of state.origin) params.push(["origin", value]);
  for (const value of state.spec) params.push(["spec", value]);
  if (state.min) params.push(["min", state.min]);
  if (state.max) params.push(["max", state.max]);
  if (state.stock) params.push(["stock", state.stock]);
  if (state.sale) params.push(["sale", state.sale]);
  if (state.rating) params.push(["rating", state.rating]);
  if (state.page > 1) params.push(["page", String(state.page)]);
  return params;
}

/** Builds a `/shop` href for the given state. */
export function shopHref(state: ShopState): string {
  const qs = new URLSearchParams(shopParams(state)).toString();
  return qs ? `/shop?${qs}` : "/shop";
}

/** Adds or removes one value from a multi-select filter. */
export function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

/** Whether a multi-select filter currently contains a value. */
export function isSelected(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

/** Number of distinct filters applied (used for the sidebar badges). */
export function activeFilterCount(state: ShopState): number {
  let count =
    state.brand.length +
    state.colour.length +
    state.connectivity.length +
    state.warranty.length +
    state.origin.length +
    state.spec.length;
  if (state.min) count += 1;
  if (state.max) count += 1;
  if (state.stock) count += 1;
  if (state.sale) count += 1;
  if (state.rating) count += 1;
  if (state.q) count += 1;
  if (state.category) count += 1;
  return count;
}
