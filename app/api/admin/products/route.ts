import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type ProductBody = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  categorySlug?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  badge?: unknown;
  short?: unknown;
  description?: unknown;
  specs?: unknown;
  stock?: unknown;
  isActive?: unknown;
  imagePath?: unknown;
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(`${field} must be between ${min} and ${max} characters.`);
  }
  return trimmed;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new Error(`${field} must be at most ${max} characters.`);
  }
  return value.trim();
}

function parseProduct(raw: unknown) {
  const body = (raw ?? {}) as ProductBody;
  const title = text(body.title, "Title", 1, 180);

  let slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug) || slug.length > 120) {
    throw new Error("Slug may only contain lowercase letters, digits and dashes.");
  }

  const categorySlug = text(body.categorySlug, "Category", 1, 60);

  const price = typeof body.price === "number" ? body.price : NaN;
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw new Error("Price must be a number between 0 and 100000.");
  }

  let compareAtPrice: number | null = null;
  if (body.compareAtPrice != null && body.compareAtPrice !== "") {
    const value = Number(body.compareAtPrice);
    if (!Number.isFinite(value) || value < 0) throw new Error("Compare-at price is invalid.");
    compareAtPrice = value;
  }

  const stock = typeof body.stock === "number" ? body.stock : Math.floor(Number(body.stock));
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    throw new Error("Stock must be a whole number of 0 or more.");
  }

  const description = Array.isArray(body.description)
    ? (body.description as unknown[]).slice(0, 20).map((line, index) => {
        if (typeof line !== "string" || line.length > 2000) {
          throw new Error(`Description line ${index + 1} is too long.`);
        }
        return line;
      })
    : [];

  const specs: [string, string][] = Array.isArray(body.specs)
    ? (body.specs as unknown[]).slice(0, 40).map((entry, index) => {
        if (!Array.isArray(entry) || entry.length !== 2) {
          throw new Error(`Specification ${index + 1} is invalid.`);
        }
        const [name, value] = entry.map(String);
        if (!name.trim() || name.length > 120 || value.length > 300) {
          throw new Error(`Specification ${index + 1} is invalid.`);
        }
        return [name.trim(), value] as [string, string];
      })
    : [];

  return {
    slug,
    title,
    categorySlug,
    priceCents: Math.round(price * 100),
    compareAtPriceCents: compareAtPrice == null ? null : Math.round(compareAtPrice * 100),
    badge: optionalText(body.badge, "Badge", 24),
    short: typeof body.short === "string" ? body.short.trim().slice(0, 300) : "",
    description,
    specs,
    stock,
    isActive: body.isActive !== false,
    imagePath: optionalText(body.imagePath, "Image", 400),
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim() : null
  };
}

async function resolveCategory(db: ReturnType<typeof adminClient>, categorySlug: string) {
  const { data, error } = await db
    .from("categories")
    .select("id, slug")
    .eq("slug", categorySlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Choose a valid category.");
  return data.id;
}

async function writeInventory(
  db: ReturnType<typeof adminClient>,
  productId: string,
  stock: number
) {
  const existing = await db
    .from("inventory")
    .select("id")
    .eq("product_id", productId)
    .is("variant_id", null)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    const { error } = await db.from("inventory").update({ on_hand: stock }).eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("inventory").insert({ product_id: productId, variant_id: null, on_hand: stock });
    if (error) throw new Error(error.message);
  }
}

async function writeImage(
  db: ReturnType<typeof adminClient>,
  productId: string,
  imagePath: string | null
) {
  if (!imagePath) return;
  const { error } = await db
    .from("product_images")
    .upsert(
      { product_id: productId, kind: "primary", path: imagePath, position: 0 },
      { onConflict: "product_id,kind" }
    );
  if (error) throw new Error(error.message);
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "The product could not be saved.";
  const anyError = error as { code?: string };
  if (anyError?.code === "23505") return fail("That slug is already in use by another product.", 409);
  return fail(message, 500);
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let parsed;
  try {
    parsed = parseProduct(await request.json());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid product data.");
  }

  const db = adminClient(session);
  try {
    const categoryId = await resolveCategory(db, parsed.categorySlug);
    const { data, error } = await db
      .from("products")
      .insert({
        slug: parsed.slug,
        title: parsed.title,
        category_id: categoryId,
        short_description: parsed.short,
        description: parsed.description,
        specs: parsed.specs.map(([name, value]) => ({ name, value })),
        price_cents: parsed.priceCents,
        compare_at_price_cents: parsed.compareAtPriceCents,
        badge: parsed.badge,
        is_active: parsed.isActive
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeInventory(db, data.id, parsed.stock);
    await writeImage(db, data.id, parsed.imagePath);
    return NextResponse.json({ id: data.id, slug: parsed.slug }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let parsed;
  try {
    parsed = parseProduct(await request.json());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid product data.");
  }
  if (!parsed.id) return fail("Product id is required.");

  const db = adminClient(session);
  try {
    const categoryId = await resolveCategory(db, parsed.categorySlug);
    const { data, error } = await db
      .from("products")
      .update({
        slug: parsed.slug,
        title: parsed.title,
        category_id: categoryId,
        short_description: parsed.short,
        description: parsed.description,
        specs: parsed.specs.map(([name, value]) => ({ name, value })),
        price_cents: parsed.priceCents,
        compare_at_price_cents: parsed.compareAtPriceCents,
        badge: parsed.badge,
        is_active: parsed.isActive
      })
      .eq("id", parsed.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("That product no longer exists.", 404);

    await writeInventory(db, parsed.id, parsed.stock);
    await writeImage(db, parsed.id, parsed.imagePath);
    return NextResponse.json({ id: parsed.id, slug: parsed.slug });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Product id is required.");

  const db = adminClient(session);
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
