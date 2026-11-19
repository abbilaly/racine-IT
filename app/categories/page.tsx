import Link from "next/link";
import CategoriesHub, { type HubCategory } from "@/components/CategoriesHub";
import { categoryDescription } from "@/lib/category-copy";
import { imageUrl } from "@/lib/products";
import { requireCatalog } from "@/lib/server/catalog";
import { loadCategoryContent } from "@/lib/server/category-content";
import "./categories.css";

export const metadata = {
  title: "Categories — AB Tech",
  description:
    "Browse every AB Tech category: computers and laptops, components, networking, smartphones, gaming, printers, monitors and more."
};

/**
 * Categories Hub.
 *
 * Deliberately a real page rather than a drawer: the mobile "Categories" tab
 * navigates here. Everything shown is read from the live catalogue — the
 * taxonomy, the product counts, the child categories and the brands — so the
 * page can never advertise a category the shop does not actually have.
 */
export default async function CategoriesPage() {
  const catalog = await requireCatalog();
  const content = await loadCategoryContent();

  const countByCategory = new Map<string, number>();
  const brandsByCategory = new Map<string, Map<string, number>>();
  const firstImageByCategory = new Map<string, string>();

  for (const product of catalog.products) {
    if (!product.category) continue;
    countByCategory.set(product.category, (countByCategory.get(product.category) ?? 0) + 1);
    if (!firstImageByCategory.has(product.category) && product.image) {
      firstImageByCategory.set(product.category, product.image);
    }
    if (product.brand) {
      const brands = brandsByCategory.get(product.category) ?? new Map<string, number>();
      brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1);
      brandsByCategory.set(product.category, brands);
    }
  }

  const byKey = new Map(catalog.categories.map(category => [category.key, category]));

  const rows: HubCategory[] = catalog.categories.map(category => {
    const presentation = content.get(category.key);
    const scopedImage = firstImageByCategory.get(category.key);
    // Real imagery only: a category banner, or the first product photo in the
    // category. Otherwise the card renders its branded icon instead of an
    // unrelated stock illustration.
    const image = presentation?.bannerPath
      ? imageUrl(presentation.bannerPath)
      : scopedImage
        ? imageUrl(scopedImage)
        : "";

    const brands = Array.from(brandsByCategory.get(category.key) ?? new Map<string, number>())
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);

    return {
      key: category.key,
      label: category.label,
      count: countByCategory.get(category.key) ?? 0,
      image,
      description: presentation?.description ?? categoryDescription(category.key),
      children: [],
      brands,
      iconKey: presentation?.icon ?? null
    };
  });

  // Attach real child categories. The hierarchy is whatever the database says;
  // nothing is invented when a category has no children.
  const childKeysByParent = new Map<string, string[]>();
  for (const [slug, presentation] of content) {
    if (!presentation.parentSlug || !byKey.has(presentation.parentSlug)) continue;
    const list = childKeysByParent.get(presentation.parentSlug) ?? [];
    list.push(slug);
    childKeysByParent.set(presentation.parentSlug, list);
  }

  const rowByKey = new Map(rows.map(row => [row.key, row]));
  for (const [parentSlug, childKeys] of childKeysByParent) {
    const parent = rowByKey.get(parentSlug);
    if (!parent) continue;
    parent.children = childKeys
      .map(key => rowByKey.get(key))
      .filter((child): child is HubCategory => Boolean(child))
      .map(child => ({ key: child.key, label: child.label, count: child.count }));
  }

  const topLevel = rows.filter(row => !content.get(row.key)?.parentSlug);

  return (
    <main className="site-shell page categories-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Categories</span>
      </nav>

      <CategoriesHub categories={topLevel} totalProducts={catalog.products.length} />
    </main>
  );
}
