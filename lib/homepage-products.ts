import { isDraftPreview, type Product } from "@/lib/products";

/**
 * Homepage merchandising.
 *
 * The old homepage sliced the catalogue by array position, so it showed the
 * same handful of products in several sections. This selector works from the
 * live catalogue instead: it takes at most one product per category in each
 * round, which gives the first rows genuine category variety and never depends
 * on where a product happens to sit in the array.
 */

export type HomepageSelection = {
  /** Owner-curated approved products, or a diverse in-stock fallback. */
  featured: Product[];
  /** Broader selection for the second row, never overlapping `featured`. */
  discovery: Product[];
};

type SelectionOptions = {
  featuredLimit?: number;
  discoveryLimit?: number;
  /** Active category keys, in store order. */
  categoryOrder?: readonly string[];
};

/** In-stock products first, then newest, then title for a stable order. */
function rankProducts(a: Product, b: Product): number {
  const stockRank = Number(b.stock > 0) - Number(a.stock > 0);
  if (stockRank !== 0) return stockRank;
  const newest = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  if (newest !== 0) return newest;
  return a.title.localeCompare(b.title);
}

/**
 * Picks products round-robin across categories. A product is removed from the
 * pool as soon as it is picked, so callers can reuse the same exclusion set to
 * guarantee that no product appears in two homepage sections.
 */
function pickDiverse(
  products: readonly Product[],
  limit: number,
  exclude: Set<string>,
  categoryOrder: readonly string[]
): Product[] {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    if (exclude.has(product.slug)) continue;
    if (isDraftPreview(product)) continue;
    const group = groups.get(product.category) ?? [];
    group.push(product);
    groups.set(product.category, group);
  }

  // Keep the store's category order first, then append any category the
  // catalogue returns that the order does not know about.
  const order = categoryOrder.filter(key => groups.has(key));
  for (const key of groups.keys()) {
    if (!order.includes(key)) order.push(key);
  }

  const ranked = new Map(
    order.map(key => [key, (groups.get(key) ?? []).slice().sort(rankProducts)])
  );

  const picks: Product[] = [];
  for (let round = 0; picks.length < limit; round += 1) {
    let added = false;
    for (const key of order) {
      const product = ranked.get(key)?.[round];
      if (!product || exclude.has(product.slug)) continue;
      picks.push(product);
      exclude.add(product.slug);
      added = true;
      if (picks.length >= limit) break;
    }
    if (!added) break;
  }

  return picks;
}

/**
 * Builds both homepage rows from the catalogue that is actually loaded.
 *
 * - Curated `products.is_featured` rows are respected exactly (up to the
 *   featured limit).
 * - With no curated products, the featured row is a diverse in-stock fallback
 *   rather than the first five catalogue entries.
 * - The discovery row covers the wider approved catalogue and excludes
 *   everything already shown above. Draft previews are not merchandised on the
 *   homepage; they remain available in the shop for internal review.
 */
export function selectHomepageProducts(
  products: readonly Product[],
  featuredSlugs: readonly string[] = [],
  options: SelectionOptions = {}
): HomepageSelection {
  const featuredLimit = Math.max(0, options.featuredLimit ?? 5);
  const discoveryLimit = Math.max(0, options.discoveryLimit ?? 10);
  const categoryOrder = options.categoryOrder ?? [];
  const bySlug = new Map(products.map(product => [product.slug, product]));

  const curated = [...new Set(featuredSlugs)]
    .map(slug => bySlug.get(slug))
    .filter((product): product is Product => Boolean(product))
    .filter(product => !isDraftPreview(product))
    .slice(0, featuredLimit);

  const used = new Set<string>();
  const featured =
    curated.length > 0
      ? curated
      : pickDiverse(products, featuredLimit, used, categoryOrder);

  // `pickDiverse` already records fallback picks; recording curated picks here
  // keeps the same guarantee for owner-selected products.
  for (const product of featured) used.add(product.slug);
  const discovery = pickDiverse(products, discoveryLimit, used, categoryOrder);

  return { featured, discovery };
}
