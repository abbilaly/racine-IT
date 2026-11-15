import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ShopControls from "@/components/ShopControls";
import ShopFacets from "@/components/ShopFacets";
import ShopPagination from "@/components/ShopPagination";
import {
  SORT_OPTIONS,
  buildFacetGroups,
  filterCatalogue,
  labelFor,
  paginate,
  parseSpecParam,
  sortProducts,
  type SortKey
} from "@/lib/products";
import { readShopState, shopHref } from "@/lib/shop-params";
import { loadCatalog } from "@/lib/server/catalog";
import "./shop.css";

type RawParams = Record<string, string | string[] | undefined>;

export const metadata = {
  title: "Shop — AB Tech",
  description:
    "Browse phones, laptops, tablets, audio and wearables with filters, sorting and live search."
};

function toNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const state = readShopState(sp);
  const sort: SortKey = SORT_OPTIONS.some(o => o.key === state.sort)
    ? (state.sort as SortKey)
    : "featured";

  const catalog = await loadCatalog();
  const categoryLabel = (key: string) => labelFor(catalog.categories, key);

  // Facets are built from the category scope, so a filter never disappears
  // because another filter is currently applied.
  const scoped = state.category
    ? catalog.products.filter(p => p.category === state.category)
    : catalog.products;
  const facets = buildFacetGroups(scoped);

  // Category counts come from the whole active catalogue, not the current
  // category scope, so the sidebar still shows where the other products live.
  const countsByCategory = new Map<string, number>();
  for (const product of catalog.products) {
    countsByCategory.set(product.category, (countsByCategory.get(product.category) ?? 0) + 1);
  }
  const categories = catalog.categories.map(category => ({
    key: category.key,
    label: category.label,
    count: countsByCategory.get(category.key) ?? 0
  }));

  const specs = state.spec
    .map(parseSpecParam)
    .filter((value): value is { key: string; value: string } => value !== null);

  const filtered = filterCatalogue(scoped, {
    q: state.q,
    brands: state.brand,
    colours: state.colour,
    connectivities: state.connectivity,
    warranties: state.warranty,
    origins: state.origin,
    minPrice: toNumber(state.min),
    maxPrice: toNumber(state.max),
    inStockOnly: state.stock === "in",
    onSaleOnly: state.sale === "1",
    minRating: toNumber(state.rating),
    specs
  });

  const paged = paginate(sortProducts(filtered, sort), state.page);

  const heading = state.q
    ? `Results for “${state.q}”`
    : state.category
      ? categoryLabel(state.category)
      : "All Products";

  const hasFilters =
    state.brand.length > 0 ||
    state.colour.length > 0 ||
    state.connectivity.length > 0 ||
    state.warranty.length > 0 ||
    state.origin.length > 0 ||
    state.spec.length > 0 ||
    Boolean(
      state.min ||
        state.max ||
        state.stock ||
        state.sale ||
        state.rating ||
        state.q ||
        state.category
    );

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Shop</span>
        {state.category && <> <span>/</span> <span>{categoryLabel(state.category)}</span></>}
      </nav>

      <div className="page-heading">
        <h1>{heading}</h1>
        <p>
          {paged.total} product{paged.total === 1 ? "" : "s"}
          {state.q && <> matching “{state.q}”</>}
          {paged.pages > 1 && <> · page {paged.page} of {paged.pages}</>}
        </p>
      </div>

      <ShopControls state={{ ...state, sort }} total={paged.total} />

      <div className="shop-layout">
        <ShopFacets state={state} facets={facets} categories={categories} total={paged.total} />

        <div className="shop-results">
          {paged.items.length === 0 ? (
            <div className="empty-state">
              <h2>No products found</h2>
              <p>Nothing matches these filters yet. Try removing a filter or browsing the full catalogue.</p>
              <div className="empty-actions">
                {hasFilters && <Link href="/shop" className="btn-dark">Clear all filters</Link>}
                <Link href={shopHref({ ...state, category: "", q: "", page: 1 })} className="btn-ghost">
                  Browse all products
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="deal-grid shop-grid">
                {paged.items.map(p => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
              <ShopPagination state={state} page={paged.page} pages={paged.pages} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
