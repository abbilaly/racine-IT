import type { AdminSession } from "@/lib/server/admin-auth";
import type { AdminClient } from "@/lib/server/admin-client";
import { formatCents } from "@/lib/orders";

/*
 * The admin data layer lives on top of a runtime Supabase client supplied by
 * the caller. We intentionally do not create that client here because the
 * project’s generated Supabase types are not used and the column selections
 * are hand-written strings. The `as` casts below are safe only because every
 * select string is maintained alongside the corresponding normalization code.
 */

/** Shared server data access for the admin ERP modules. */
export { formatCents };

type Page = { page?: number; limit?: number };

function range(pagination?: Page) {
  const parsedPage = Math.max(1, parseInt(String(pagination?.page ?? 1), 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(pagination?.limit ?? 50), 10)));
  return { offset: (parsedPage - 1) * parsedLimit, limit: parsedLimit };
}

export function last30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export type CategoryRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  position: number;
  /** False for categories kept in the database but hidden from the storefront
   *  (for example the retired ``tablets`` and ``audio`` rows). Requires 0007. */
  is_active: boolean;
  /** Hierarchy from migration 0008: null means a top-level category. */
  parent_id: string | null;
  /** Storefront icon key (0008); null uses the built-in icon for the slug. */
  icon: string | null;
  /** Optional category banner image path (0008). */
  banner_path: string | null;
};

/** Fields an operator can change on a category. The slug is immutable. */
export type CategoryInput = {
  label?: string;
  description?: string | null;
  parentId?: string | null;
  icon?: string | null;
  bannerPath?: string | null;
  isActive?: boolean;
  position?: number;
};

/** Full column set: 0007 (is_active) plus 0008 presentation columns. */
const CATEGORY_COLUMNS =
  "id, slug, label, position, is_active, description, parent_id, icon, banner_path";
/** 0007 applied, 0008 not yet. */
const CATEGORY_COLUMNS_0007 = "id, slug, label, position, is_active";
/** Pre-0007: no is_active column. */
const CATEGORY_COLUMNS_LEGACY = "id, slug, label, position";

const CATEGORY_COLUMN_TIERS = [
  CATEGORY_COLUMNS,
  CATEGORY_COLUMNS_0007,
  CATEGORY_COLUMNS_LEGACY
] as const;

type PgError = { code?: string; message?: string } | null;

/**
 * PostgREST reports a column the database does not have with 42703 (unknown
 * column) or PGRST204 (missing from the schema cache). Only those errors are
 * safe to retry with a narrower column list; anything else (network, RLS,
 * missing table) is a real failure and is surfaced to the operator.
 */
function isMissingColumn(error: PgError): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

function pickColumns(payload: Record<string, unknown>, columns: string): Record<string, unknown> {
  const allowed = new Set(columns.split(",").map(column => column.trim()).filter(Boolean));
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (allowed.has(key)) picked[key] = value;
  }
  return picked;
}

/**
 * Runs a category query against the newest schema first and falls back one
 * migration at a time, so the same build works on a database with 0007+0008,
 * with 0007 only, or with neither.
 */
async function runCategoryQuery<T>(
  db: AdminClient,
  build: (columns: string) => PromiseLike<{ data: unknown; error: PgError }>
): Promise<{ data: T | null }> {
  let failure: PgError = null;
  for (const columns of CATEGORY_COLUMN_TIERS) {
    const result = await build(columns);
    if (!result.error) return { data: (result.data ?? null) as T | null };
    failure = result.error;
    if (!isMissingColumn(result.error)) break;
  }
  throw new Error(failure?.message ?? "The category query failed.");
}

function normaliseCategory(row: Record<string, unknown>): CategoryRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    description: typeof row.description === "string" ? row.description : null,
    position: typeof row.position === "number" ? row.position : 0,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    parent_id: typeof row.parent_id === "string" ? row.parent_id : null,
    icon: typeof row.icon === "string" ? row.icon : null,
    banner_path: typeof row.banner_path === "string" ? row.banner_path : null
  };
}

/** Every category, active or not. Used by the admin category list and by the
 *  product EDIT selector, so an operator can always see — and move a product
 *  off — a category that has been deactivated. */
export async function listCategories(db: AdminClient): Promise<CategoryRow[]> {
  const { data } = await runCategoryQuery<Record<string, unknown>[]>(db, columns =>
    db.from("categories").select(columns).order("position")
  );
  return (data ?? []).map(normaliseCategory);
}

/** Active categories only. Used where a NEW product gets filed (create form and
 *  CSV import) so nothing new can be added to a deactivated category. */
export async function listActiveCategories(db: AdminClient): Promise<CategoryRow[]> {
  const rows = await listCategories(db);
  return rows.filter((row) => row.is_active);
}

/** Live product counts per category id, for the admin category list. Counts
 *  include hidden products because the admin needs to know a category is still
 *  in use before it can be deleted. */
export async function categoryProductCounts(db: AdminClient): Promise<Map<string, number>> {
  const { data, error } = await db.from("products").select("category_id");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ category_id: string | null }>) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

export async function getCategoryById(db: AdminClient, id: string): Promise<CategoryRow | null> {
  const { data } = await runCategoryQuery<Record<string, unknown>>(db, columns =>
    db.from("categories").select(columns).eq("id", id).maybeSingle()
  );
  return data ? normaliseCategory(data) : null;
}

/** Active categories only: every caller resolves a category so that a new
 *  product can be filed onto it, and a deactivated category must not accept
 *  new products. The admin UI uses listCategories() when it needs everything. */
export async function getCategoryBySlug(db: AdminClient, slug: string): Promise<CategoryRow | null> {
  const { data } = await runCategoryQuery<Record<string, unknown>>(db, columns => {
    const query = db.from("categories").select(columns).eq("slug", slug);
    // Pre-0007 there is no inactive category to exclude.
    const activeOnly = columns.includes("is_active") ? query.eq("is_active", true) : query;
    return activeOnly.maybeSingle();
  });
  return data ? normaliseCategory(data) : null;
}

export async function createCategory(
  db: AdminClient,
  input: CategoryInput & { slug: string; label: string }
): Promise<CategoryRow> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    label: input.label,
    is_active: input.isActive ?? true
  };
  if (input.position !== undefined) row.position = input.position;
  if (input.description != null) row.description = input.description;
  if (input.parentId != null) row.parent_id = input.parentId;
  if (input.icon != null) row.icon = input.icon;
  if (input.bannerPath != null) row.banner_path = input.bannerPath;

  let failure: PgError = null;
  for (const tier of CATEGORY_COLUMN_TIERS) {
    // Widen to `string`: a literal union makes PostgREST's parser generic infer
    // an error type for `.select()`.
    const columns: string = tier;
    const result = await db
      .from("categories")
      .insert(pickColumns(row, columns))
      .select(columns)
      .single();
    if (!result.error && result.data) return normaliseCategory(result.data as unknown as Record<string, unknown>);
    failure = result.error;
    if (!isMissingColumn(result.error)) break;
  }
  throw new Error(failure?.message ?? "The category could not be created.");
}

/** Refuses a parent that is the category itself or one of its descendants. */
async function assertValidParent(db: AdminClient, id: string, parentId: string): Promise<void> {
  if (parentId === id) throw new Error("A category cannot be its own parent.");
  const rows = await listCategories(db);
  const byId = new Map(rows.map(row => [row.id, row]));
  if (!byId.has(parentId)) throw new Error("The selected parent category no longer exists.");
  const seen = new Set<string>();
  let cursor = byId.get(parentId)?.parent_id ?? null;
  while (cursor && !seen.has(cursor)) {
    if (cursor === id) throw new Error("That parent would create a loop in the category tree.");
    seen.add(cursor);
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
}

export async function updateCategory(
  db: AdminClient,
  id: string,
  input: CategoryInput
): Promise<CategoryRow> {
  if (input.parentId != null) await assertValidParent(db, id, input.parentId);

  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.position !== undefined) patch.position = input.position;
  // Only sent when the caller asks for it, so editing copy can never flip a
  // retired category back into the storefront by accident.
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.description !== undefined) patch.description = input.description;
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.bannerPath !== undefined) patch.banner_path = input.bannerPath;

  let failure: PgError = null;
  for (const tier of CATEGORY_COLUMN_TIERS) {
    const columns: string = tier;
    const result = await db
      .from("categories")
      .update(pickColumns(patch, columns))
      .eq("id", id)
      .select(columns)
      .maybeSingle();
    if (!result.error) {
      if (!result.data) throw new Error("Category not found.");
      return normaliseCategory(result.data as unknown as Record<string, unknown>);
    }
    failure = result.error;
    if (!isMissingColumn(result.error)) break;
  }
  throw new Error(failure?.message ?? "The category could not be updated.");
}

export async function deleteCategory(db: AdminClient, id: string): Promise<void> {
  // products.category_id has no ON DELETE clause, so the foreign key blocks the
  // delete whether or not the product is active. Check first so the admin sees
  // a clear message instead of a raw constraint violation.
  const { data: inUse, error: inUseError } = await db
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);
  if (inUseError) throw new Error(inUseError.message);
  if ((inUse ?? []).length > 0) {
    throw new Error("Cannot delete this category: products still use it. Reassign them to another category first.");
  }

  // Subcategories are a real relationship (0008), so a parent cannot be
  // deleted out from under its children either.
  const rows = await listCategories(db);
  const child = rows.find(row => row.parent_id === id);
  if (child) {
    throw new Error(`Cannot delete this category: "${child.label}" is filed under it. Move or delete the child category first.`);
  }

  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  /** Brand logo path (0002). Null means no logo has been uploaded yet. */
  logo_path: string | null;
};

const BRAND_COLUMNS = "id, name, slug, description, position, logo_path";

export async function listBrands(db: AdminClient, pagination?: Page) {
  const { offset, limit } = range(pagination);
  const { data, error, count } = await db.from("brands").select(BRAND_COLUMNS, { count: "exact" }).order("position").order("name").range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as BrandRow[], total: count ?? 0 };
}

export async function allBrands(db: AdminClient): Promise<BrandRow[]> {
  const { data, error } = await db.from("brands").select(BRAND_COLUMNS).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandRow[];
}

export async function getBrandBySlug(db: AdminClient, slug: string): Promise<BrandRow | null> {
  const { data, error } = await db.from("brands").select(BRAND_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as BrandRow | null;
}

export async function createBrand(db: AdminClient, input: { name: string; slug: string; description?: string | null; logoPath?: string | null; position?: number }): Promise<BrandRow> {
  const { data, error } = await db.from("brands").insert({ name: input.name, slug: input.slug, description: input.description ?? null, logo_path: input.logoPath ?? null, position: input.position ?? 0 }).select(BRAND_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as BrandRow;
}

export async function updateBrand(db: AdminClient, id: string, input: { name?: string; slug?: string; description?: string | null; logoPath?: string | null; position?: number }): Promise<BrandRow> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.logoPath !== undefined) patch.logo_path = input.logoPath;
  if (input.position !== undefined) patch.position = input.position;
  const { data, error } = await db.from("brands").update(patch).eq("id", id).select(BRAND_COLUMNS).single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Brand not found.");
  return data as BrandRow;
}

export async function deleteBrand(db: AdminClient, id: string): Promise<void> {
  const { error } = await db.from("brands").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Categories a brand is represented in (table `brand_categories`, 0008).
 * Returns an empty list when the link table has not been created yet, so the
 * brand editor still loads on an older database.
 */
export async function listBrandCategoryIds(db: AdminClient, brandId: string): Promise<string[]> {
  const { data, error } = await db.from("brand_categories").select("category_id").eq("brand_id", brandId);
  if (error) {
    if (error.code === "42P01" || /does not exist/i.test(error.message ?? "")) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<{ category_id: string }>).map(row => row.category_id);
}

/** Replaces the brand's category links with exactly the supplied set. */
export async function setBrandCategories(db: AdminClient, brandId: string, categoryIds: string[]): Promise<void> {
  const unique = Array.from(new Set(categoryIds.filter(Boolean)));
  const { error: clearError } = await db.from("brand_categories").delete().eq("brand_id", brandId);
  if (clearError) {
    if (clearError.code === "42P01" || /does not exist/i.test(clearError.message ?? "")) {
      throw new Error("Brand/category links need migration 0008_catalogue_presentation.sql, which is not applied to this database.");
    }
    throw new Error(clearError.message);
  }
  if (unique.length === 0) return;
  const { error } = await db
    .from("brand_categories")
    .insert(unique.map(categoryId => ({ brand_id: brandId, category_id: categoryId })));
  if (error) throw new Error(error.message);
}

export type ProductImageRow = {
  id: string;
  kind: string;
  path: string;
  position: number;
  is_primary: boolean;
};

export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  category: { id: string; slug: string; label: string } | null;
  brand: { id: string; slug: string; name: string } | null;
  short_description: string;
  description: string[] | null;
  specs: { name: string; value: string }[] | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  badge: string | null;
  rating: number | string;
  reviews: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  /** Country of origin, only when documented (0008). */
  origin: string | null;
  /** Supplier or manufacturer page the data was verified against (0008). */
  source_url: string | null;
  images: ProductImageRow[];
  stock: number;
};

export type ProductDetailRow = ProductRow & { on_hand: number | null };

const PRODUCT_COLUMNS =
  "id, slug, title, category:categories(id, slug, label), brand:brands(id, slug, name), short_description, description, specs, price_cents, compare_at_price_cents, badge, rating, reviews, is_active, is_featured, origin, source_url, created_at, product_images(id, kind, path, position), inventory(on_hand, variant_id)";

function normaliseProduct(row: Record<string, unknown>): ProductRow {
  const categoryRaw = row.category;
  const category = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
  const brandRaw = row.brand;
  const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw;
  const images = ((row.product_images ?? []) as Array<Omit<ProductImageRow, "is_primary">>)
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((image) => ({ ...image, is_primary: image.kind === "primary" }));
  const inventory = (row.inventory ?? []) as Array<{ on_hand: number; variant_id: string | null }>;
  const stock = inventory.reduce((sum, line) => sum + (line.variant_id === null ? line.on_hand : 0), 0);
  const onHandLine = inventory.find((line) => line.variant_id === null);
  return {
    ...(row as unknown as ProductRow),
    category: (category ?? null) as ProductRow["category"],
    brand: (brand ?? null) as ProductRow["brand"],
    images,
    stock,
    on_hand: onHandLine ? onHandLine.on_hand : null,
  } as ProductRow;
}

export async function listProducts(
  db: AdminClient,
  params: {
    q?: string;
    category?: string;
    brand?: string;
    status?: "active" | "hidden" | "all";
    page?: number;
    limit?: number;
  } = {}
): Promise<{ rows: ProductRow[]; total: number }> {
  const { offset, limit } = range({ page: params.page, limit: params.limit });
  let query = db.from("products").select(PRODUCT_COLUMNS, { count: "exact" }).order("title");
  if (params.q) query = query.or(`title.ilike.%${params.q}%, short_description.ilike.%${params.q}%`);
  if (params.category) {
    const cat = await getCategoryBySlug(db, params.category);
    if (!cat) return { rows: [] as ProductRow[], total: 0 };
    query = query.eq("category_id", cat.id);
  }
  if (params.brand) {
    const brand = await getBrandBySlug(db, params.brand);
    if (!brand) return { rows: [] as ProductRow[], total: 0 };
    query = query.eq("brand_id", brand.id);
  }
  if (params.status === "active") query = query.eq("is_active", true);
  else if (params.status === "hidden") query = query.eq("is_active", false);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as Record<string, unknown>[]).map(normaliseProduct), total: count ?? 0 };
}

export async function getProductDetail(db: AdminClient, id: string): Promise<ProductDetailRow | null> {
  const { data, error } = await db.from("products").select(PRODUCT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return normaliseProduct(data as unknown as Record<string, unknown>) as ProductDetailRow;
}

export type OrderListRow = {
  id: string;
  ref: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  item_count: number;
  subtotal: number;
  shipping: number;
  total: number;
  delivery: string;
  payment: string;
  note: string | null;
  created_at: string;
};

export async function listOrders(
  db: AdminClient,
  params: { status?: string; q?: string; from?: string | null; to?: string | null; page?: number; limit?: number } = {}
): Promise<{ rows: OrderListRow[]; total: number }> {
  const { offset, limit } = range({ page: params.page, limit: params.limit });
  let query = db
    .from("orders")
    .select("id, ref, status, first_name, last_name, email, item_count, subtotal, shipping, total, delivery, payment, note, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.q) query = query.or(`email.ilike.%${params.q}%, first_name.ilike.%${params.q}%, last_name.ilike.%${params.q}%, ref.ilike.%${params.q}%`);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as OrderListRow[], total: count ?? 0 };
}

export type OrderDetailRow = OrderListRow & {
  phone: string;
  address: string;
  city: string;
  postal: string;
  country: string;
  user_id: string | null;
  order_items: {
    id: number;
    product_id: string | null;
    slug: string;
    title: string;
    variant_name: string | null;
    unit_price: number;
    qty: number;
    line_total: number;
    snapshot: Record<string, unknown> | null;
  }[];
};

export async function getOrderDetail(db: AdminClient, id: string): Promise<OrderDetailRow | null> {
  const { data, error } = await db.from("orders").select("*, order_items(id, product_id, slug, title, variant_name, unit_price, qty, line_total, snapshot)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...data, order_items: (data.order_items ?? []) as OrderDetailRow["order_items"] } as OrderDetailRow;
}

export async function getOrderSummary(db: AdminClient) {
  const { data, error } = await db.from("orders").select("total, status");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ total: number; status: string }>;
  const live = rows.filter((row) => row.status !== "cancelled");
  const total_orders = live.length;
  const total_revenue_cents = live.reduce((sum, row) => sum + row.total, 0);
  return {
    total_orders,
    total_revenue_cents,
    average_order_value_cents: total_orders > 0 ? Math.round(total_revenue_cents / total_orders) : 0,
  };
}

export type RecentOrderRow = {
  id: string;
  ref: string;
  status: string;
  first_name: string;
  last_name: string;
  item_count: number;
  total: number;
  created_at: string;
};

export async function getRecentOrders(db: AdminClient, limit = 6): Promise<RecentOrderRow[]> {
  const { data, error } = await db.from("orders").select("id, ref, status, first_name, last_name, item_count, total, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RecentOrderRow[];
}

export type InventoryRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  on_hand: number;
  updated_at: string;
};

export async function getInventoryForProduct(db: AdminClient, productId: string): Promise<InventoryRow[]> {
  const { data, error } = await db.from("inventory").select("id, product_id, variant_id, on_hand, updated_at").eq("product_id", productId).order("variant_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryRow[];
}

export type StockAdjustmentRow = {
  id: string;
  inventory_id: string | null;
  product_id: string;
  variant_id: string | null;
  change: number;
  reason: string;
  note: string | null;
  adjusted_by: string | null;
  created_at: string;
};

export async function listStockAdjustments(db: AdminClient, productId?: string, pagination?: Page): Promise<{ rows: StockAdjustmentRow[]; total: number }> {
  const { offset, limit } = range(pagination);
  let query = db.from("stock_adjustments").select("id, inventory_id, product_id, variant_id, change, reason, note, adjusted_by, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (productId) query = query.eq("product_id", productId);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as StockAdjustmentRow[], total: count ?? 0 };
}

export type StockAdjustmentInput = {
  inventory_id?: string | null;
  product_id: string;
  variant_id?: string | null;
  change: number;
  reason: string;
  note?: string | null;
};

export async function createStockAdjustment(db: AdminClient, session: AdminSession, input: StockAdjustmentInput): Promise<StockAdjustmentRow> {
  if (!Number.isInteger(input.change) || input.change === 0) throw new Error("Stock change must be a non-zero whole number.");
  const reason = (input.reason ?? "").trim();
  if (reason.length < 1 || reason.length > 120) throw new Error("Reason must be between 1 and 120 characters.");

  let inventoryId: string | null = input.inventory_id ?? null;
  let currentOnHand = 0;
  if (inventoryId) {
    const current = await db.from("inventory").select("id, on_hand").eq("id", inventoryId).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) throw new Error("Inventory row not found.");
    currentOnHand = current.data.on_hand;
  } else {
    const target = await db.from("inventory").select("id, on_hand").eq("product_id", input.product_id).is("variant_id", input.variant_id ?? null).maybeSingle();
    if (target.error) throw new Error(target.error.message);
    if (!target.data) throw new Error("Inventory row not found for this product.");
    inventoryId = target.data.id as string;
    currentOnHand = target.data.on_hand as number;
  }
  const nextOnHand = currentOnHand + input.change;
  if (nextOnHand < 0) throw new Error(`Only ${currentOnHand} unit${currentOnHand === 1 ? "" : "s"} on hand; this adjustment would make stock negative.`);

  const { data, error } = await db
    .from("stock_adjustments")
    .insert({ inventory_id: inventoryId, product_id: input.product_id, variant_id: input.variant_id ?? null, change: input.change, reason, note: input.note ?? null, adjusted_by: session.userId })
    .select("id, inventory_id, product_id, variant_id, change, reason, note, adjusted_by, created_at")
    .single();
  if (error) throw new Error(error.message);

  const { error: inventoryError } = await db.from("inventory").update({ on_hand: nextOnHand }).eq("id", inventoryId);
  if (inventoryError) throw new Error(inventoryError.message);

  return data as StockAdjustmentRow;
}

export type QuotationRow = {
  id: string;
  ref: string;
  customer_name: string;
  customer_company: string | null;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  valid_from: string;
  valid_until: string;
  notes: string | null;
  terms: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  converted_order_id: string | null;
  created_by: string | null;
  created_at: string;
};

const QUOTATION_COLUMNS =
  "id, ref, customer_name, customer_company, customer_email, customer_phone, status, valid_from, valid_until, notes, terms, subtotal_cents, tax_cents, total_cents, currency, converted_order_id, created_by, created_at";

export async function listQuotations(db: AdminClient, params: { status?: string; q?: string; page?: number; limit?: number } = {}): Promise<{ rows: QuotationRow[]; total: number }> {
  const { offset, limit } = range({ page: params.page, limit: params.limit });
  let query = db.from("quotations").select(QUOTATION_COLUMNS, { count: "exact" }).order("created_at", { ascending: false });
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.q) query = query.or(`customer_email.ilike.%${params.q}%, customer_name.ilike.%${params.q}%, ref.ilike.%${params.q}%`);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as QuotationRow[], total: count ?? 0 };
}

export type QuotationLineRow = {
  id: string;
  quotation_id: string;
  product_id: string | null;
  slug: string;
  title: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  discount_percent: number;
  description: string | null;
};

export type QuotationDetailRow = QuotationRow & { quotation_lines: QuotationLineRow[] };

export async function getQuotationDetail(db: AdminClient, id: string): Promise<QuotationDetailRow | null> {
  const { data, error } = await db.from("quotations").select(`${QUOTATION_COLUMNS}, quotation_lines(id, quotation_id, product_id, slug, title, qty, unit_price_cents, line_total_cents, discount_percent, description)`).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...data, quotation_lines: (data.quotation_lines ?? []) as QuotationLineRow[] } as QuotationDetailRow;
}

export async function createQuotation(db: AdminClient, session: AdminSession, input: { customer_name: string; customer_company?: string | null; customer_email: string; customer_phone?: string | null; valid_until: string; notes?: string | null; terms?: string | null }): Promise<QuotationRow> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let ref = "";
  for (const b of bytes) ref += alphabet[b % alphabet.length];
  const { data, error } = await db
    .from("quotations")
    .insert({ ref, customer_name: input.customer_name, customer_company: input.customer_company ?? null, customer_email: input.customer_email, customer_phone: input.customer_phone ?? null, valid_from: new Date().toISOString(), valid_until: input.valid_until, notes: input.notes ?? null, terms: input.terms ?? null, status: "draft", created_by: session.userId })
    .select(QUOTATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as QuotationRow;
}

export async function updateQuotation(db: AdminClient, id: string, input: Partial<{ customer_name: string; customer_company: string | null; customer_email: string; customer_phone: string | null; valid_from: string; valid_until: string; notes: string | null; terms: string | null; status: string }>): Promise<QuotationRow> {
  const { data, error } = await db.from("quotations").update(input).eq("id", id).select(QUOTATION_COLUMNS).single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quotation not found.");
  return data as QuotationRow;
}

export async function addQuotationLine(db: AdminClient, quotationId: string, input: { product_id?: string | null; slug: string; title: string; qty: number; unit_price_cents: number; line_total_cents?: number; discount_percent?: number; description?: string | null }): Promise<string> {
  const lineTotal = Math.round(input.line_total_cents ?? input.unit_price_cents * input.qty);
  const { data, error } = await db
    .from("quotation_lines")
    .insert({ quotation_id: quotationId, product_id: input.product_id ?? null, slug: input.slug, title: input.title, qty: input.qty, unit_price_cents: input.unit_price_cents, line_total_cents: lineTotal, discount_percent: input.discount_percent ?? 0, description: input.description ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function removeQuotationLine(db: AdminClient, quotationId: string, lineId: string): Promise<void> {
  const { error } = await db.from("quotation_lines").delete().eq("quotation_id", quotationId).eq("id", lineId);
  if (error) throw new Error(error.message);
}

export async function recalculateQuotationTotals(db: AdminClient, quotationId: string): Promise<{ subtotal_cents: number; tax_cents: number; total_cents: number }> {
  const { data, error } = await db.from("quotation_lines").select("line_total_cents, discount_percent").eq("quotation_id", quotationId);
  if (error) throw new Error(error.message);
  let subtotal = 0;
  for (const row of data ?? []) {
    const discount = Number(row.discount_percent ?? 0) / 100;
    subtotal += Math.round((row.line_total_cents ?? 0) * (1 - discount));
  }
  const tax_cents = 0;
  const total_cents = subtotal + tax_cents;
  const { error: updateError } = await db.from("quotations").update({ subtotal_cents: subtotal, tax_cents, total_cents }).eq("id", quotationId);
  if (updateError) throw new Error(updateError.message);
  return { subtotal_cents: subtotal, tax_cents, total_cents };
}

export type AdminNoteRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  author_id: string | null;
  author_email: string | null;
  note: string;
  created_at: string;
};

export async function listAdminNotes(db: AdminClient, subjectType: string, subjectId: string, pagination?: Page): Promise<{ rows: AdminNoteRow[]; total: number }> {
  const { offset, limit } = range(pagination);
  const { data, error, count } = await db.from("admin_notes").select("id, subject_type, subject_id, author_id, note, created_at", { count: "exact" }).eq("subject_type", subjectType).eq("subject_id", subjectId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as Array<Omit<AdminNoteRow, "author_email">>).map((row) => ({ ...row, author_email: null }));
  return { rows, total: count ?? 0 };
}

export async function createAdminNote(db: AdminClient, session: AdminSession, input: { subject_type: string; subject_id: string; note: string }): Promise<AdminNoteRow> {
  const note = (input.note ?? "").trim();
  if (note.length < 1 || note.length > 4000) throw new Error("Note must be between 1 and 4000 characters.");
  const { data, error } = await db
    .from("admin_notes")
    .insert({ subject_type: input.subject_type, subject_id: input.subject_id, author_id: session.userId, note })
    .select("id, subject_type, subject_id, author_id, note, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Omit<AdminNoteRow, "author_email">), author_email: session.email || null };
}

export type SalesPoint = { period: string; orders: number; revenue_cents: number };

export async function salesReport(db: AdminClient, from: string, to: string): Promise<SalesPoint[]> {
  const { data, error } = await db.from("orders").select("created_at, status, total").gte("created_at", from).lte("created_at", to);
  if (error) throw new Error(error.message);
  const grouped = new Map<string, SalesPoint>();
  for (const row of (data ?? []) as Array<{ created_at: string; status: string; total: number }>) {
    if (row.status === "cancelled") continue;
    const period = row.created_at.slice(0, 10);
    const existing = grouped.get(period);
    if (existing) { existing.orders += 1; existing.revenue_cents += row.total; } else grouped.set(period, { period, orders: 1, revenue_cents: row.total });
  }
  return Array.from(grouped.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export type BestSellerRow = { slug: string; title: string; units_sold: number; revenue_cents: number };

export async function bestSellingProducts(db: AdminClient, limit = 20): Promise<BestSellerRow[]> {
  const { data, error } = await db.from("order_items").select("slug, title, qty, line_total");
  if (error) throw new Error(error.message);
  const map = new Map<string, BestSellerRow>();
  for (const row of (data ?? []) as Array<{ slug: string; title: string; qty: number; line_total: number }>) {
    const existing = map.get(row.slug);
    if (existing) { existing.units_sold += row.qty; existing.revenue_cents += row.line_total; } else map.set(row.slug, { slug: row.slug, title: row.title, units_sold: row.qty, revenue_cents: row.line_total });
  }
  return Array.from(map.values()).sort((a, b) => b.revenue_cents - a.revenue_cents).slice(0, limit);
}

export type LowStockRow = { id: string; slug: string; title: string; stock: number };

export async function lowStockProducts(db: AdminClient, threshold = 5): Promise<LowStockRow[]> {
  const { data, error } = await db.from("inventory").select("product_id, on_hand").lt("on_hand", threshold + 1).is("variant_id", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ product_id: string; on_hand: number }>;
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.product_id);
  const { data: products, error: productError } = await db.from("products").select("id, slug, title").in("id", ids);
  if (productError) throw new Error(productError.message);
  const stockByProduct = new Map(rows.map((row) => [row.product_id, row.on_hand]));
  return ((products ?? []) as Array<{ id: string; slug: string; title: string }>)
    .map((product) => ({ id: product.id, slug: product.slug, title: product.title, stock: stockByProduct.get(product.id) ?? 0 }))
    .sort((a, b) => a.stock - b.stock);
}

export type OrdersByStatusRow = { status: string; count: number; total_cents: number };

export async function ordersByStatus(db: AdminClient): Promise<OrdersByStatusRow[]> {
  const { data, error } = await db.from("orders").select("status, total");
  if (error) throw new Error(error.message);
  const grouped = new Map<string, OrdersByStatusRow>();
  for (const row of (data ?? []) as Array<{ status: string; total: number }>) {
    const existing = grouped.get(row.status);
    if (existing) { existing.count += 1; existing.total_cents += row.total; } else grouped.set(row.status, { status: row.status, count: 1, total_cents: row.total });
  }
  return Array.from(grouped.values());
}

export type CustomerRow = {
  email: string;
  name: string;
  order_count: number;
  total_spent_cents: number;
  last_order_at: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
};

export async function listCustomers(db: AdminClient, params: { q?: string; page?: number; limit?: number } = {}): Promise<{ rows: CustomerRow[]; total: number }> {
  const { offset, limit } = range({ page: params.page, limit: params.limit });
  let query = db.from("orders").select("email, first_name, last_name, phone, city, country, status, total, created_at");
  if (params.q) query = query.or(`email.ilike.%${params.q}%, first_name.ilike.%${params.q}%, last_name.ilike.%${params.q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const map = new Map<string, CustomerRow>();
  for (const row of (data ?? []) as Array<{ email: string; first_name: string; last_name: string; phone: string; city: string; country: string; status: string; total: number; created_at: string }>) {
    const key = row.email.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (row.status !== "cancelled") { existing.order_count += 1; existing.total_spent_cents += row.total; }
      if (!existing.last_order_at || row.created_at > existing.last_order_at) existing.last_order_at = row.created_at;
    } else {
      map.set(key, { email: row.email, name: `${row.first_name} ${row.last_name}`.trim(), order_count: row.status === "cancelled" ? 0 : 1, total_spent_cents: row.status === "cancelled" ? 0 : row.total, last_order_at: row.created_at, phone: row.phone, city: row.city, country: row.country });
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => b.total_spent_cents - a.total_spent_cents);
  return { rows: rows.slice(offset, offset + limit), total: rows.length };
}

export async function getCustomer(db: AdminClient, email: string): Promise<CustomerRow | null> {
  const { rows } = await listCustomers(db, { q: email, limit: 1000 });
  const key = email.toLowerCase();
  return rows.find((row) => row.email.toLowerCase() === key) ?? null;
}

export async function getCustomerOrders(db: AdminClient, email: string, pagination?: Page) {
  const { offset, limit } = range(pagination);
  const { data, error, count } = await db.from("orders").select("id, ref, status, item_count, total, delivery, payment, created_at", { count: "exact" }).eq("email", email).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Array<Record<string, unknown>>, total: count ?? 0 };
}

/* -------------------------------------------------------------------------- */
/* Dashboard overview                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Revenue definitions, fixed by the order lifecycle in `public.orders`:
 *
 *   gross      every order placed in the window, cancelled included
 *   confirmed  orders that were not cancelled (received → delivered)
 *   realized    orders marked delivered only
 *
 * There is no refund/returned status and no payment-captured flag in the
 * schema, so no refund or "collected cash" figure is invented here.
 */
export const DASHBOARD_STATUSES = [
  "received",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
] as const;

export const DASHBOARD_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export type DashboardTotals = {
  gross_cents: number;
  confirmed_cents: number;
  realized_cents: number;
  orders_all: number;
  orders_confirmed: number;
  aov_cents: number;
  customers: number;
  new_customers: number;
};

export type DashboardSeriesPoint = {
  key: string;
  label: string;
  revenue_cents: number;
  orders: number;
};

type OrderWindowRow = {
  total: number;
  status: string;
  email: string;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function dayLabel(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function monthLabel(key: string): string {
  const date = new Date(`${key}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

/** New customers are emails whose first non-cancelled order falls in the window. */
async function countNewCustomers(db: AdminClient, fromISO: string, emails: string[]): Promise<number> {
  if (emails.length === 0) return 0;
  const { data, error } = await db.from("orders").select("email, created_at").neq("status", "cancelled");
  if (error) throw new Error(error.message);

  const firstOrder = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ email: string; created_at: string }>) {
    const key = row.email.toLowerCase();
    const previous = firstOrder.get(key);
    if (!previous || row.created_at < previous) firstOrder.set(key, row.created_at);
  }

  return emails.filter((email) => {
    const first = firstOrder.get(email.toLowerCase());
    return Boolean(first && first >= fromISO);
  }).length;
}

export async function dashboardTotals(
  db: AdminClient,
  fromISO: string,
  toISO: string
): Promise<DashboardTotals> {
  const { data, error } = await db
    .from("orders")
    .select("total, status, email, created_at")
    .gte("created_at", fromISO)
    .lte("created_at", toISO);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as OrderWindowRow[];
  const confirmed = rows.filter((row) => row.status !== "cancelled");
  const realized = rows.filter((row) => row.status === "delivered");
  const emails = Array.from(new Set(confirmed.map((row) => row.email)));

  const confirmedCents = confirmed.reduce((sum, row) => sum + row.total, 0);
  const newCustomers = await countNewCustomers(db, fromISO, emails);

  return {
    gross_cents: rows.reduce((sum, row) => sum + row.total, 0),
    confirmed_cents: confirmedCents,
    realized_cents: realized.reduce((sum, row) => sum + row.total, 0),
    orders_all: rows.length,
    orders_confirmed: confirmed.length,
    aov_cents: confirmed.length > 0 ? Math.round(confirmedCents / confirmed.length) : 0,
    customers: emails.length,
    new_customers: newCustomers
  };
}

/** Continuous series: every day (or month) in the window is present, gaps as zero. */
export async function salesSeriesInRange(
  db: AdminClient,
  fromISO: string,
  toISO: string,
  granularity: "day" | "month"
): Promise<DashboardSeriesPoint[]> {
  const { data, error } = await db
    .from("orders")
    .select("created_at, total, status")
    .gte("created_at", fromISO)
    .lte("created_at", toISO);
  if (error) throw new Error(error.message);

  const buckets = new Map<string, { revenue_cents: number; orders: number }>();
  for (const row of (data ?? []) as Array<{ created_at: string; total: number; status: string }>) {
    if (row.status === "cancelled") continue;
    const key = granularity === "day" ? row.created_at.slice(0, 10) : row.created_at.slice(0, 7);
    const bucket = buckets.get(key) ?? { revenue_cents: 0, orders: 0 };
    bucket.revenue_cents += row.total;
    bucket.orders += 1;
    buckets.set(key, bucket);
  }

  const points: DashboardSeriesPoint[] = [];
  const start = new Date(fromISO);
  const end = new Date(toISO);

  if (granularity === "day") {
    for (let time = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      time <= end.getTime();
      time += DAY_MS) {
      const key = utcDayKey(new Date(time));
      const bucket = buckets.get(key) ?? { revenue_cents: 0, orders: 0 };
      points.push({ key, label: dayLabel(key), ...bucket });
    }
  } else {
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
    while (cursor <= last) {
      const key = utcMonthKey(new Date(cursor));
      const bucket = buckets.get(key) ?? { revenue_cents: 0, orders: 0 };
      points.push({ key, label: monthLabel(key), ...bucket });
      const date = new Date(cursor);
      cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    }
  }

  return points;
}

export async function ordersByStatusInRange(
  db: AdminClient,
  fromISO: string,
  toISO: string
): Promise<OrdersByStatusRow[]> {
  const { data, error } = await db
    .from("orders")
    .select("status, total")
    .gte("created_at", fromISO)
    .lte("created_at", toISO);
  if (error) throw new Error(error.message);

  const grouped = new Map<string, OrdersByStatusRow>();
  for (const row of (data ?? []) as Array<{ status: string; total: number }>) {
    const existing = grouped.get(row.status);
    if (existing) {
      existing.count += 1;
      existing.total_cents += row.total;
    } else {
      grouped.set(row.status, { status: row.status, count: 1, total_cents: row.total });
    }
  }

  return DASHBOARD_STATUSES.map(
    (status) => grouped.get(status) ?? { status, count: 0, total_cents: 0 }
  );
}

export async function topProductsInRange(
  db: AdminClient,
  fromISO: string,
  toISO: string,
  limit = 5
): Promise<BestSellerRow[]> {
  const { data: orders, error: orderError } = await db
    .from("orders")
    .select("id")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .neq("status", "cancelled");
  if (orderError) throw new Error(orderError.message);

  const ids = ((orders ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data: items, error: itemError } = await db
    .from("order_items")
    .select("slug, title, qty, line_total")
    .in("order_id", ids);
  if (itemError) throw new Error(itemError.message);

  const map = new Map<string, BestSellerRow>();
  for (const row of (items ?? []) as Array<{ slug: string; title: string; qty: number; line_total: number }>) {
    const existing = map.get(row.slug);
    if (existing) {
      existing.units_sold += row.qty;
      existing.revenue_cents += row.line_total;
    } else {
      map.set(row.slug, { slug: row.slug, title: row.title, units_sold: row.qty, revenue_cents: row.line_total });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .slice(0, limit);
}
