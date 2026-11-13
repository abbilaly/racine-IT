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
   *  (for example the retired ``tablets`` and ``audio`` rows). */
  is_active: boolean;
};

const CATEGORY_COLUMNS = "id, slug, label, position, is_active";
/** Column list for a database where migration 0007 has not been applied yet. */
const CATEGORY_COLUMNS_LEGACY = "id, slug, label, position";

/**
 * `categories.is_active` is created by migration 0007. Until that migration is
 * applied and verified, admin category queries must not fail: they fall back to
 * the legacy column list and treat every existing category as active (which is
 * exactly the pre-0007 truth — every category is visible).
 */
function missingIsActive(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (/is_active/i.test(message) && /does not exist|schema cache/i.test(message))
  );
}

function normaliseCategory(
  row: Record<string, unknown>,
  description: string | null = null
): CategoryRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    position: row.position as number,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    description
  };
}

/** Every category, active or not. Used by the admin category list and by the
 *  product EDIT selector, so an operator can always see — and move a product
 *  off — a category that has been deactivated. */
export async function listCategories(db: AdminClient): Promise<CategoryRow[]> {
  const { data, error } = await db.from("categories").select(CATEGORY_COLUMNS).order("position");
  if (!error) return (data ?? []).map((row) => normaliseCategory(row as Record<string, unknown>));
  if (!missingIsActive(error)) throw new Error(error.message);

  const legacy = await db.from("categories").select(CATEGORY_COLUMNS_LEGACY).order("position");
  if (legacy.error) throw new Error(legacy.error.message);
  return (legacy.data ?? []).map((row) => normaliseCategory(row as Record<string, unknown>));
}

/** Active categories only. Used where a NEW product gets filed (create form and
 *  CSV import) so nothing new can be added to a deactivated category. */
export async function listActiveCategories(db: AdminClient): Promise<CategoryRow[]> {
  const rows = await listCategories(db);
  return rows.filter((row) => row.is_active);
}

export async function getCategoryById(db: AdminClient, id: string): Promise<CategoryRow | null> {
  const { data, error } = await db.from("categories").select(CATEGORY_COLUMNS).eq("id", id).maybeSingle();
  if (!error) return data ? normaliseCategory(data as Record<string, unknown>) : null;
  if (!missingIsActive(error)) throw new Error(error.message);

  const legacy = await db.from("categories").select(CATEGORY_COLUMNS_LEGACY).eq("id", id).maybeSingle();
  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data ? normaliseCategory(legacy.data as Record<string, unknown>) : null;
}

/** Active categories only: every caller resolves a category so that a new
 *  product can be filed onto it, and a deactivated category must not accept
 *  new products. The admin UI uses listCategories() when it needs everything. */
export async function getCategoryBySlug(db: AdminClient, slug: string): Promise<CategoryRow | null> {
  const { data, error } = await db
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!error) return data ? normaliseCategory(data as Record<string, unknown>) : null;
  if (!missingIsActive(error)) throw new Error(error.message);

  // Pre-0007 there is no inactive category to exclude.
  const legacy = await db
    .from("categories")
    .select(CATEGORY_COLUMNS_LEGACY)
    .eq("slug", slug)
    .maybeSingle();
  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data ? normaliseCategory(legacy.data as Record<string, unknown>) : null;
}

export async function createCategory(db: AdminClient, input: { slug: string; label: string; description?: string | null }): Promise<CategoryRow> {
  const first = await db
    .from("categories")
    .insert({ slug: input.slug, label: input.label, is_active: true })
    .select(CATEGORY_COLUMNS)
    .single();
  if (!first.error && first.data) {
    return normaliseCategory(first.data as Record<string, unknown>, input.description ?? null);
  }
  if (!missingIsActive(first.error)) {
    throw new Error(first.error?.message ?? "The category could not be created.");
  }

  // Pre-0007: the column does not exist, so it is omitted from the insert.
  const legacy = await db
    .from("categories")
    .insert({ slug: input.slug, label: input.label })
    .select(CATEGORY_COLUMNS_LEGACY)
    .single();
  if (legacy.error || !legacy.data) {
    throw new Error(legacy.error?.message ?? "The category could not be created.");
  }
  return normaliseCategory(legacy.data as Record<string, unknown>, input.description ?? null);
}

export async function updateCategory(db: AdminClient, id: string, input: { label?: string; description?: string | null; position?: number }): Promise<CategoryRow> {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.position !== undefined) patch.position = input.position;
  // is_active is deliberately not patchable here: it is preserved by omission,
  // so editing a label can never accidentally reactivate or deactivate a row.
  const first = await db.from("categories").update(patch).eq("id", id).select(CATEGORY_COLUMNS).single();
  if (!first.error && first.data) {
    return normaliseCategory(first.data as Record<string, unknown>, input.description ?? null);
  }
  if (!missingIsActive(first.error)) {
    throw new Error(first.error?.message ?? "The category could not be updated.");
  }

  const legacy = await db
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select(CATEGORY_COLUMNS_LEGACY)
    .single();
  if (legacy.error) throw new Error(legacy.error.message);
  if (!legacy.data) throw new Error("Category not found.");
  return normaliseCategory(legacy.data as Record<string, unknown>, input.description ?? null);
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

  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
};

export async function listBrands(db: AdminClient, pagination?: Page) {
  const { offset, limit } = range(pagination);
  const { data, error, count } = await db.from("brands").select("id, name, slug, description, position", { count: "exact" }).order("position").order("name").range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as BrandRow[], total: count ?? 0 };
}

export async function allBrands(db: AdminClient): Promise<BrandRow[]> {
  const { data, error } = await db.from("brands").select("id, name, slug, description, position").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandRow[];
}

export async function getBrandBySlug(db: AdminClient, slug: string): Promise<BrandRow | null> {
  const { data, error } = await db.from("brands").select("id, name, slug, description, position").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as BrandRow | null;
}

export async function createBrand(db: AdminClient, input: { name: string; slug: string; description?: string | null; position?: number }): Promise<BrandRow> {
  const { data, error } = await db.from("brands").insert({ name: input.name, slug: input.slug, description: input.description ?? null, position: input.position ?? 0 }).select("id, name, slug, description, position").single();
  if (error) throw new Error(error.message);
  return data as BrandRow;
}

export async function updateBrand(db: AdminClient, id: string, input: { name?: string; slug?: string; description?: string | null; position?: number }): Promise<BrandRow> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.position !== undefined) patch.position = input.position;
  const { data, error } = await db.from("brands").update(patch).eq("id", id).select("id, name, slug, description, position").single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Brand not found.");
  return data as BrandRow;
}

export async function deleteBrand(db: AdminClient, id: string): Promise<void> {
  const { error } = await db.from("brands").delete().eq("id", id);
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
  images: ProductImageRow[];
  stock: number;
};

export type ProductDetailRow = ProductRow & { on_hand: number | null };

const PRODUCT_COLUMNS =
  "id, slug, title, category:categories(id, slug, label), brand:brands(id, slug, name), short_description, description, specs, price_cents, compare_at_price_cents, badge, rating, reviews, is_active, is_featured, created_at, product_images(id, kind, path, position), inventory(on_hand, variant_id)";

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
