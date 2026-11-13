import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  listActiveCategories,
  listBrands,
  createCategory,
  updateCategory,
  createBrand,
  updateBrand,
} from "@/lib/server/admin-data";
import type { AdminClient } from "@/lib/server/admin-client";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type LooseAdminClient = { from: (table: string) => any };

const MAX_PREVIEW_ROWS = 200;
const MAX_IMPORT_ROWS = 500;
const CSV_HEADER = [
  "slug",
  "title",
  "category",
  "brand",
  "price",
  "compare_at_price",
  "stock",
  "badge",
  "short_description",
  "description",
  "is_active",
].join(",");

type ImportRow = {
  slug: string;
  title: string;
  category: string;
  brand: string;
  price: string | number;
  compare_at_price: string | number | null;
  stock: string | number;
  badge: string | null;
  short_description: string;
  description: string;
  is_active: string | boolean;
};

type PreviewRow = ImportRow & {
  errors: string[];
  matched_category: string | null;
  matched_brand: string | null;
  suggested_slug: string;
};

function parseCsV(body: string): string[][] {
  const lines: string[][] = [];
  let current = "";
  let field: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field.push('"');
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field.push(ch);
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      field.push(current);
      current = "";
      lines.push(field);
      field = [];
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (next === "\r" || next === "\n") i++;
      field.push(current.trim());
      current = "";
      lines.push(field.filter(Boolean));
      field = [];
      continue;
    }
    current += ch;
  }

  if (current || field.length) {
    field.push(current.trim());
    lines.push(field.filter(Boolean));
  }

  return lines;
}

function parseFloatField(value: string | undefined, field: string): number | null {
  if (value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
  return Math.round(num * 100);
}

function parseBoolField(value: string | boolean | undefined, defaultTo = true) {
  if (value === undefined || value === "") return defaultTo;
  if (typeof value === "boolean") return value;
  const lower = String(value).toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1" || lower === "active") return true;
  if (lower === "false" || lower === "no" || lower === "0" || lower === "hidden") return false;
  throw new Error(`Invalid value for field: ${String(value)}`);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveSlug(raw: string | undefined, title: string, existing: Set<string>): string {
  let slug = raw && raw.trim() ? raw.trim().toLowerCase() : slugify(title);
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    slug = slugify(title);
  }
  if (!slug) throw new Error("Title is required to generate a slug.");
  if (slug.length > 120) slug = slug.slice(0, 120);
  if (existing.has(slug)) {
    let n = 2;
    while (existing.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  existing.add(slug);
  return slug;
}

export async function GET(request: Request) {
  // Return the import template for download.
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const body = [
    "# AB Tech product import template",
    "# Upload this file to /admin/products/import",
    CSV_HEADER,
    "# Required: title, price",
    "# category and brand must match an existing slug exactly",
    "sample-product,new product,smartphones,racine-it,29.99,49.99,100,,Short summary,Description paragraph one. Description paragraph two.,active",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="products_import_template.csv"`,
    },
  });
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: AdminClient;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart") && !contentType.includes("text/csv") && !contentType.includes("application/json")) {
    return fail("Upload the file as multipart form data or raw CSV text.", 400);
  }

  let raw: string;
  try {
    if (contentType.includes("multipart")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) {
        return fail("A CSV file is required.", 400);
      }
      raw = new TextDecoder().decode(await file.arrayBuffer());
    } else {
      raw = await request.text();
    }
  } catch {
    return fail("Could not read the uploaded file.", 400);
  }

  const lines = parseCsV(raw);
  if (lines.length < 2) {
    return fail("The CSV must have a header row and at least one data row.", 400);
  }

  const header = lines[0].map((c) => c.trim().toLowerCase());
  const needed = ["slug", "title", "price"];
  for (const field of needed) {
    if (!header.includes(field)) {
      return fail(`The CSV must include a ${field} column.`, 400);
    }
  }

  const indexOf = (name: string) => header.indexOf(name);

  // load reference data once
  let categories: Array<{ slug: string; label: string }>;
  let brands: Array<{ slug: string; name: string }>;
  try {
    categories = await listActiveCategories(db);
    ({ rows: brands } = await listBrands(db, { page: 1, limit: 500 }));
  } catch (error) {
    return fail("Could not load categories or brands for import validation.", 500);
  }

  const categoryMap = new Map(categories.map((c) => [c.slug.toLowerCase(), c.slug]));
  const brandMap = new Map(brands.map((b) => [b.slug.toLowerCase(), b.slug]));

  const seenSlugs = new Set<string>();
  const preview: PreviewRow[] = [];
  let parseError: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;
    if (preview.length > MAX_PREVIEW_ROWS) {
      parseError = `Only the first ${MAX_PREVIEW_ROWS} rows were previewed.`;
      break;
    }

    const slug = line[indexOf("slug")];
    const title = line[indexOf("title")];
    const category = line[indexOf("category")];
    const brand = line[indexOf("brand")];
    const price = line[indexOf("price")];
    const compare_at_price = line[indexOf("compare_at_price")];
    const stock = line[indexOf("stock")];
    const badge = line[indexOf("badge")];
    const short_description = line[indexOf("short_description")];
    const description = line[indexOf("description")];
    const is_active = line[indexOf("is_active")];

    if (!title) {
      preview.push({
        slug: slug ?? "",
        title: "",
        category: category ?? "",
        brand: brand ?? "",
        price: "",
        compare_at_price: compare_at_price ?? null,
        stock: stock ?? 0,
        badge: null,
        short_description: short_description ?? "",
        description: description ?? "",
        is_active: is_active ?? true,
        errors: ["Title is required."],
        matched_category: null,
        matched_brand: null,
        suggested_slug: "",
      });
      continue;
    }

    const rowErrors: string[] = [];
    const parsedPrice = parseFloatField(price, "price");
    if (parsedPrice === null) rowErrors.push("Price must be a non-negative number.");

    const parsedCompareAt = compare_at_price !== undefined && compare_at_price !== ""
      ? parseFloatField(compare_at_price, "compare_at_price")
      : null;
    if (parsedCompareAt !== null && parsedPrice !== null && parsedCompareAt < parsedPrice) {
      rowErrors.push("Compare-at price must be at least the selling price.");
    }

    const parsedStock = parseInt(stock, 10);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      rowErrors.push("Stock must be a non-negative whole number.");
    }

    const parsedActive = parseBoolField(is_active, true);

    const resolvedCategory = category && category.trim()
      ? categoryMap.get(category.trim().toLowerCase()) ?? null
      : null;
    if (resolvedCategory === null && category && category.trim()) {
      rowErrors.push(`Category "${category.trim()}" was not found.`);
    }

    const resolvedBrand = brand && brand.trim()
      ? brandMap.get(brand.trim().toLowerCase()) ?? null
      : null;
    if (resolvedBrand === null && brand && brand.trim()) {
      rowErrors.push(`Brand "${brand.trim()}" was not found.`);
    }

    let suggested_slug = "";
    try {
      suggested_slug = resolveSlug(slug, title, seenSlugs);
    } catch {
      rowErrors.push("Could not generate a valid slug from the title.");
    }

    preview.push({
      slug: slug ?? "",
      title,
      category: category ?? "",
      brand: brand ?? "",
      price,
      compare_at_price: compare_at_price ?? null,
      stock: parsedStock,
      badge: badge || null,
      short_description: short_description ?? "",
      description: description ?? "",
      is_active: parsedActive,
      errors: rowErrors,
      matched_category: resolvedCategory,
      matched_brand: resolvedBrand,
      suggested_slug,
    });
  }

  const hasErrorRows = preview.some((row) => row.errors.length > 0);
  const rawRowCount = lines.length - 1;

  return NextResponse.json(
    {
      preview: preview,
      total_rows: rawRowCount,
      preview_rows: preview.length,
      has_error_rows: hasErrorRows,
      template_header: CSV_HEADER,
    },
    {
      headers: {
        "X-Import-Config": JSON.stringify({
          mode: "preview",
          max_preview_rows: MAX_PREVIEW_ROWS,
          max_import_rows: MAX_IMPORT_ROWS,
        }),
      },
    }
  );
}

export async function PATCH(request: Request) {
  // Apply a previewed import. The payload must match the preview shape and
  // include the admin's confirm decision.
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: LooseAdminClient;
  try {
    db = getAdminClient(session) as unknown as LooseAdminClient;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  let body: {
    decisions: Array<{
      sku?: string;
      title: string;
      category?: string;
      brand?: string;
      price: number | null;
      compare_at_price: number | null;
      stock: number;
      badge?: string | null;
      short_description?: string;
      description?: string;
      slug?: string;
      is_active?: boolean;
      action: "create" | "update" | "skip";
    }>;
    mode: "apply" | "preview";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  if (body.mode !== "apply") {
    return fail("Use POST to preview, then PATCH with mode=apply to save.", 400);
  }

  if (!Array.isArray(body.decisions) || body.decisions.length === 0) {
    return fail("No rows were selected for import.", 400);
  }
  if (body.decisions.length > MAX_IMPORT_ROWS) {
    return fail(`Imports are limited to ${MAX_IMPORT_ROWS} rows per request.`, 400);
  }

  const results: Array<{ row: number; action: string; slug: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < body.decisions.length; i++) {
    const decision = body.decisions[i];
    const rowNumber = i + 2;

    if (!decision.title) {
      results.push({ row: rowNumber, action: "skip", slug: "", ok: false, error: "Title is required." });
      continue;
    }

    if (decision.action === "skip") {
      results.push({ row: rowNumber, action: "skip", slug: "", ok: true });
      continue;
    }

    const slug = decision.slug?.trim().toLowerCase() || decision.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      results.push({ row: rowNumber, action: decision.action, slug, ok: false, error: "Invalid slug." });
      continue;
    }

    if (!decision.price && decision.price !== 0) {
      results.push({ row: rowNumber, action: decision.action, slug, ok: false, error: "Price is required." });
      continue;
    }

    const priceCents = Math.round((decision.price ?? 0) * 100);
    const compareAtPriceCents = decision.compare_at_price == null ? null : Math.round((decision.compare_at_price) * 100);

    const categoryRow = decision.category?.trim()
      ? await db.from("categories").select("id").eq("slug", decision.category.trim().toLowerCase()).eq("is_active", true).maybeSingle().then((r: { data: { id: string } | null }) => r.data, () => null)
      : null;
    if (!categoryRow && decision.category?.trim()) {
      results.push({ row: rowNumber, action: decision.action, slug, ok: false, error: `Category not found: ${decision.category}.` });
      continue;
    }

    try {
      const { data, error } = await db
        .from("products")
        .upsert(
          {
            slug,
            title: decision.title.trim(),
            category_id: categoryRow?.id ?? (await db.from("categories").select("id").eq("slug", "smartphones").eq("is_active", true).maybeSingle()).data?.id,
            short_description: decision.short_description?.trim() ?? "",
            description: (decision.description ?? "")
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .slice(0, 20),
            price_cents: priceCents,
            compare_at_price_cents: compareAtPriceCents,
            badge: decision.badge?.trim() || null,
            is_active: decision.is_active !== false,
          },
          { onConflict: "slug" }
        )
        .select("id, slug")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Product upsert returned no row.");

      const inventory = await db
        .from("inventory")
        .upsert(
          { product_id: data.id, variant_id: null, on_hand: decision.stock },
          { onConflict: "product_id, variant_id" }
        )
        .select("id")
        .single();

      if (inventory.error) throw inventory.error;

      results.push({ row: rowNumber, action: decision.action, slug: data.slug, ok: true });
    } catch (error) {
      results.push({
        row: rowNumber,
        action: decision.action,
        slug,
        ok: false,
        error: error instanceof Error ? error.message : "Could not save product.",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const errorCount = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    applied: okCount,
    failed: errorCount,
    results,
    mode: "apply",
  });
}
