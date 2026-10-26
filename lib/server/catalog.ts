import { cache } from "react";
import {
  productMap,
  seedCatalog,
  type Catalog,
  type CategoryOption,
  type Product,
  type StoreSettings
} from "@/lib/products";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Catalogue access for server-rendered pages.
 *
 * With Supabase configured the catalogue comes from Postgres (products,
 * categories, images, inventory and store settings). Without it the app
 * serves the seeded demo catalogue that ships in lib/products.ts, so the
 * storefront keeps working in local development before credentials exist.
 */

type CategoryRow = { slug: string; label: string; position: number };

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string[] | null;
  specs: { name: string; value: string }[] | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  badge: string | null;
  rating: number | string;
  reviews: number;
  /** PostgREST returns the embedded to-one relation as an object or a one-element array. */
  category: unknown;
};

type ImageRow = { product_id: string; kind: string; path: string };
type InventoryRow = { product_id: string; variant_id: string | null; on_hand: number };

type SettingsRow = {
  store_name: string;
  currency: string;
  standard_shipping_cents: number;
  express_shipping_cents: number;
  checkout_enabled: boolean;
};

function toSettings(row: SettingsRow | null): StoreSettings {
  if (!row) return seedCatalog().settings;
  return {
    storeName: row.store_name,
    currency: row.currency,
    standardShipping: row.standard_shipping_cents / 100,
    expressShipping: row.express_shipping_cents / 100,
    checkoutEnabled: row.checkout_enabled
  };
}

async function fetchCatalogFromSupabase(): Promise<Catalog | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const [categoriesRes, productsRes, imagesRes, inventoryRes, settingsRes] = await Promise.all([
    supabase.from("categories").select("slug,label,position").order("position"),
    supabase
      .from("products")
      .select(
        "id,slug,title,short_description,description,specs,price_cents,compare_at_price_cents,badge,rating,reviews,category:categories(slug,label)"
      )
      .eq("is_active", true)
      .order("created_at"),
    supabase.from("product_images").select("product_id,kind,path").in("kind", ["primary", "hover"]),
    supabase.from("inventory").select("product_id,variant_id,on_hand"),
    supabase.from("store_settings").select("*").eq("id", true).maybeSingle()
  ]);

  const firstError =
    categoriesRes.error ?? productsRes.error ?? imagesRes.error ?? inventoryRes.error ?? settingsRes.error;
  if (firstError) throw new Error(`Supabase catalogue query failed: ${firstError.message}`);

  const categories: CategoryOption[] = ((categoriesRes.data ?? []) as CategoryRow[]).map(row => ({
    key: row.slug,
    label: row.label
  }));

  const imagesByProduct = new Map<string, { primary?: string; hover?: string }>();
  for (const row of (imagesRes.data ?? []) as ImageRow[]) {
    const entry = imagesByProduct.get(row.product_id) ?? {};
    if (row.kind === "primary") entry.primary = row.path;
    else entry.hover = row.path;
    imagesByProduct.set(row.product_id, entry);
  }

  const stockByProduct = new Map<string, number>();
  const variantStockByProduct = new Map<string, number>();
  for (const row of (inventoryRes.data ?? []) as InventoryRow[]) {
    if (row.variant_id === null) stockByProduct.set(row.product_id, row.on_hand);
    else {
      variantStockByProduct.set(
        row.product_id,
        (variantStockByProduct.get(row.product_id) ?? 0) + row.on_hand
      );
    }
  }

  const products: Product[] = ((productsRes.data ?? []) as ProductRow[]).map(row => {
    const images = imagesByProduct.get(row.id) ?? {};
    const fallback = productMap[row.slug];
    const relation = Array.isArray(row.category) ? row.category[0] : row.category;
    const categorySlug = (relation as { slug?: string } | null | undefined)?.slug ?? "";
    const stock = stockByProduct.has(row.id)
      ? stockByProduct.get(row.id)!
      : (variantStockByProduct.get(row.id) ?? 0);
    return {
      slug: row.slug,
      title: row.title,
      category: categorySlug || fallback?.category || "",
      image: images.primary ?? fallback?.image ?? "",
      hover: images.hover ?? images.primary ?? fallback?.hover ?? "",
      price: row.price_cents / 100,
      ...(row.compare_at_price_cents != null ? { oldPrice: row.compare_at_price_cents / 100 } : {}),
      ...(row.badge ? { badge: row.badge } : {}),
      rating: Number(row.rating),
      reviews: row.reviews,
      stock,
      short: row.short_description,
      description: row.description ?? [],
      specs: (row.specs ?? []).map(spec => [spec.name, spec.value] as [string, string])
    };
  });

  return { products, categories, settings: toSettings(settingsRes.data) };
}

/** Catalogue for the current request (deduplicated by React `cache`). */
export const loadCatalog = cache(async function loadCatalog(): Promise<Catalog> {
  try {
    const catalogue = await fetchCatalogFromSupabase();
    if (catalogue) return catalogue;
  } catch (error) {
    console.error("Supabase catalogue unavailable — serving the seeded catalogue instead.", error);
  }
  return seedCatalog();
});
