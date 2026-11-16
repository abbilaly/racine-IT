import type { AdminClient } from "@/lib/server/admin-client";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductPayload = {
  slug: string;
  title: string;
  categoryId: string;
  brandId: string | null;
  shortDescription: string;
  description: string[];
  priceCents: number;
  compareAtPriceCents: number | null;
  badge: string | null;
  /** Country of origin, only when documented (0008). */
  origin: string | null;
  /** Supplier or manufacturer page the data was verified against (0008). */
  sourceUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
};

function optionalUuid(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !UUID_RE.test(value.trim())) {
    throw new Error(`${field} is not a valid record id.`);
  }
  return value.trim();
}

/**
 * Parses the payload sent by the admin ProductForm (create and edit).
 * Prices are handled in cents so no floating point money maths is involved.
 */
export function parseProductPayload(raw: unknown): ProductPayload {
  const body = (raw ?? {}) as Record<string, unknown>;

  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 180) {
    throw new Error("Title is required and must be at most 180 characters.");
  }
  const title = body.title.trim();

  let slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug) || slug.length > 120) {
    throw new Error("Slug may only contain lowercase letters, digits and dashes.");
  }

  const categoryId = optionalUuid(body.categoryId, "Category");
  if (!categoryId) throw new Error("Choose a category.");
  const brandId = optionalUuid(body.brandId, "Brand");

  const shortDescription =
    typeof body.shortDescription === "string" ? body.shortDescription.trim().slice(0, 500) : "";
  if (!shortDescription) throw new Error("Short description is required.");

  const description = Array.isArray(body.description)
    ? (body.description as unknown[]).slice(0, 30).map((line, index) => {
        if (typeof line !== "string" || line.length > 2000) {
          throw new Error(`Description line ${index + 1} is too long.`);
        }
        return line;
      })
    : [];

  const priceCents =
    typeof body.priceCents === "number" && Number.isFinite(body.priceCents)
      ? Math.round(body.priceCents)
      : NaN;
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 10_000_000) {
    throw new Error("Price must be a positive amount.");
  }

  let compareAtPriceCents: number | null = null;
  if (body.compareAtPriceCents != null && body.compareAtPriceCents !== "") {
    const raw = Number(body.compareAtPriceCents);
    if (!Number.isFinite(raw) || raw < 0) throw new Error("Compare-at price is invalid.");
    compareAtPriceCents = Math.round(raw);
    if (compareAtPriceCents < priceCents) {
      throw new Error("Compare-at price must be greater than or equal to the selling price.");
    }
  }

  let badge: string | null = null;
  if (body.badge != null && body.badge !== "") {
    if (typeof body.badge !== "string" || body.badge.trim().length > 24) {
      throw new Error("Badge must be at most 24 characters.");
    }
    badge = body.badge.trim();
  }

  // Provenance is optional and shown only when an operator records it: an
  // absent origin must stay null, never guessed from the brand or the shop.
  let origin: string | null = null;
  if (body.origin != null && body.origin !== "") {
    if (typeof body.origin !== "string") throw new Error("Country of origin must be text.");
    origin = body.origin.trim().slice(0, 80) || null;
  }

  let sourceUrl: string | null = null;
  if (body.sourceUrl != null && body.sourceUrl !== "") {
    if (typeof body.sourceUrl !== "string") throw new Error("Source URL must be text.");
    const raw = body.sourceUrl.trim();
    if (raw.length > 500) throw new Error("Source URL must be at most 500 characters.");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw);
    } catch {
      throw new Error("Source URL must be a full address starting with https://");
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Source URL must start with https:// or http://");
    }
    sourceUrl = raw;
  }

  return {
    slug,
    title,
    categoryId,
    brandId,
    shortDescription,
    description,
    priceCents,
    compareAtPriceCents,
    badge,
    origin,
    sourceUrl,
    isActive: body.is_active !== false,
    isFeatured: body.is_featured === true
  };
}

function rowFromPayload(payload: ProductPayload) {
  return {
    slug: payload.slug,
    title: payload.title,
    category_id: payload.categoryId,
    brand_id: payload.brandId,
    short_description: payload.shortDescription,
    description: payload.description,
    price_cents: payload.priceCents,
    compare_at_price_cents: payload.compareAtPriceCents,
    badge: payload.badge,
    origin: payload.origin,
    source_url: payload.sourceUrl,
    is_active: payload.isActive,
    is_featured: payload.isFeatured
  };
}

export async function createProduct(db: AdminClient, payload: ProductPayload): Promise<string> {
  const { data, error } = await db
    .from("products")
    .insert(rowFromPayload(payload))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProduct(
  db: AdminClient,
  id: string,
  payload: ProductPayload
): Promise<boolean> {
  const { data, error } = await db
    .from("products")
    .update(rowFromPayload(payload))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}