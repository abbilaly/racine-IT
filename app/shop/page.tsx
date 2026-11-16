import Link from "next/link";
import { redirect } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import CategoryBanner from "@/components/CategoryBanner";
import CategoryPanel from "@/components/CategoryPanel";
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
import { categoryDescription } from "@/lib/category-copy";
import { readShopState, shopHref } from "@/lib/shop-params";
import { loadCatalog } from "@/lib/server/catalog";
import { loadCategoryContent } from "@/lib/server/category-content";
import "./shop.css";
import "./category.css";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Old category URLs after migration 0007 renames/deactivates five rows.
 * Bookmarks and any external links keep working instead of landing on an empty
 * category: phones -> smartphones, laptops -> computers, tablets -> smartphones
 * (its products move there) and audio -> multimedia (its products move there).
 */
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  phones: "smartphones",
  laptops: "computers",
  tablets: "smartphones",
  audio: "multimedia"
};

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

  if (state.category && !catalog.categories.some(category => category.key === state.category)) {
    const alias = LEGACY_CATEGORY_ALIASES[state.category];
    if (alias && catalog.categories.some(category => category.key === alias)) {
      redirect(shopHref({ ...state, category: alias, page: 1 }));
    }
    // The catalogue only exposes active categories, so a hidden category (or a
    // typo) must not stay browsable by direct URL.
    redirect(shopHref({ ...state, category: "", page: 1 }));
  }

  const content = await loadCategoryContent();
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

  // Refinements narrow results *inside* the current scope. The category itself
  // is tracked separately: an empty category is not an empty filter result.
  const hasRefinements =
    state.brand.length > 0 ||
    state.colour.length > 0 ||
    state.connectivity.length > 0 ||
    state.warranty.length > 0 ||
    state.origin.length > 0 ||
    state.spec.length > 0 ||
    Boolean(state.min || state.max || state.stock || state.sale || state.rating || state.q);

  const hasFilters = hasRefinements || Boolean(state.category);

  // No product in this scope at all: the category is genuinely empty, not
  // filtered down to nothing. The two states must never be confused.
  const scopeIsEmpty = scoped.length === 0;
  const categoryComingSoon = scopeIsEmpty && !hasRefinements;
  const clearRefinementsHref = shopHref({
    ...state,
    q: "",
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
  });

  // Optional hierarchy/presentation data. Empty on the current production
  // schema (before migration 0008), so everything below degrades to flat
  // categories with built-in icons and copy.
  const activeContent = state.category ? content.get(state.category) : undefined;
  const parentSlug = activeContent?.parentSlug ?? null;
  const parentLabel = parentSlug ? categoryLabel(parentSlug) : null;

  const showCategoryHero = Boolean(state.category) && !state.q;

  const categoryChildren = state.category
    ? categories.filter(category => content.get(category.key)?.parentSlug === state.category)
    : [];

  const subcategoryLinks = categoryChildren.map(child => ({
    label: child.label,
    href: shopHref({ ...state, category: child.key, page: 1 }),
    count: child.count
  }));

  // Brand shortcuts filter inside the category scope (never the whole shop).
  const brandLinks = (facets.brands?.values ?? []).map(brand => {
    const active = state.brand.includes(brand.value);
    const nextBrands = active
      ? state.brand.filter(value => value !== brand.value)
      : [...state.brand, brand.value];
    return {
      label: brand.value,
      count: brand.count,
      active,
      href: shopHref({ ...state, brand: nextBrands, page: 1 })
    };
  });
  const allBrandsHref = shopHref({ ...state, brand: [], page: 1 });

  const heroImage =
    activeContent?.bannerPath ?? scoped.find(product => product.image)?.image ?? null;

  return (
    <main className="site-shell page">
      <CategoryPanel />

      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <Link href="/shop">Shop</Link>
        {parentSlug && (
          <>
            {" "}
            <span>/</span>{" "}
            <Link href={shopHref({ ...state, category: parentSlug, page: 1 })}>
              {parentLabel}
            </Link>
          </>
        )}
        {state.category && (
          <>
            {" "}
            <span>/</span> <span aria-current="page">{categoryLabel(state.category)}</span>
          </>
        )}
      </nav>

      {showCategoryHero && state.category ? (
        <CategoryBanner
          slug={state.category}
          label={categoryLabel(state.category)}
          description={activeContent?.description ?? categoryDescription(state.category)}
          icon={activeContent?.icon ?? null}
          image={heroImage}
          total={paged.total}
          subcategories={subcategoryLinks}
          brands={brandLinks}
          allBrandsHref={allBrandsHref}
        />
      ) : (
        <div className="page-heading">
          <h1>{heading}</h1>
          <p>
            {paged.total} product{paged.total === 1 ? "" : "s"}
            {state.q && <> matching “{state.q}”</>}
            {paged.pages > 1 && <> · page {paged.page} of {paged.pages}</>}
          </p>
        </div>
      )}

      <ShopControls state={{ ...state, sort }} total={paged.total} />

      <div className="shop-layout">
        <ShopFacets state={state} facets={facets} categories={categories} total={paged.total} />

        <div className="shop-results">
          {paged.items.length === 0 ? (
            categoryComingSoon ? (
              <div className="empty-state empty-state--category">
                <h2>Products coming soon</h2>
                <p>
                  {state.category
                    ? "We are preparing this category with verified stock, specifications and pricing."
                    : "The catalogue is being prepared with verified products and pricing."}
                </p>
                <div className="empty-actions">
                  <Link href={state.category ? "/shop" : "/"} className="btn-dark">
                    {state.category ? "Browse all products" : "Back to home"}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="empty-state empty-state--filters">
                <h2>No products match these filters</h2>
                <p>
                  {state.q
                    ? `Nothing matches “${state.q}” with the filters applied. Try a different search or clear the filters.`
                    : "Nothing matches the filters applied. Try removing one or widening the price range."}
                </p>
                <div className="empty-actions">
                  {hasRefinements && (
                    <Link href={clearRefinementsHref} className="btn-dark">
                      Clear all filters
                    </Link>
                  )}
                  <Link
                    href={shopHref({ ...state, category: "", q: "", page: 1 })}
                    className="btn-ghost"
                  >
                    Browse all products
                  </Link>
                </div>
              </div>
            )
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
