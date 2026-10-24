import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ShopControls from "@/components/ShopControls";
import {
  SORT_OPTIONS,
  categoryLabel,
  searchProducts,
  sortProducts,
  type SortKey
} from "@/lib/products";

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export const metadata = {
  title: "Shop — Racine IT",
  description: "Browse phones, laptops, tablets, audio and wearables with filters, sorting and live search."
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const category = first(sp.category);
  const sortRaw = first(sp.sort) as SortKey;
  const sort = SORT_OPTIONS.some(o => o.key === sortRaw) ? sortRaw : "featured";

  let list = searchProducts(q);
  if (category) list = list.filter(p => p.category === category);
  list = sortProducts(list, sort);

  const heading = q
    ? `Results for “${q}”`
    : category
      ? categoryLabel(category)
      : "All Products";

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Shop</span>
        {category && <> <span>/</span> <span>{categoryLabel(category)}</span></>}
      </nav>

      <div className="page-heading">
        <h1>{heading}</h1>
        <p>
          {list.length} product{list.length === 1 ? "" : "s"}
          {q && <> matching “{q}”</>}
        </p>
      </div>

      <ShopControls q={q} category={category} sort={sort} total={list.length} />

      {list.length === 0 ? (
        <div className="empty-state">
          <h2>No products found</h2>
          <p>Nothing matches these filters yet. Try a different search term or browse the full catalogue.</p>
          <Link href="/shop" className="btn-dark">Clear filters</Link>
        </div>
      ) : (
        <div className="deal-grid shop-grid">
          {list.map(p => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
