import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandBySlug,
  listBrandCategoryIds,
  setBrandCategories
} from "@/lib/server/admin-data";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asDb(session: Parameters<typeof getAdminClient>[0]): {
  db: ReturnType<typeof getAdminClient> | null;
  error: string | null;
} {
  try {
    return { db: getAdminClient(session), error: null };
  } catch (error) {
    return {
      db: null,
      error: error instanceof Error ? error.message : "The server is not configured."
    };
  }
}

function readBrandInput(body: Record<string, unknown>) {
  const input: {
    name?: string;
    slug?: string;
    description?: string | null;
    logoPath?: string | null;
    position?: number;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") throw new Error("Brand name must be text.");
    const name = body.name.trim();
    if (!name || name.length > 120) throw new Error("Brand name must be between 1 and 120 characters.");
    input.name = name;
  }

  if (body.slug !== undefined) {
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!slug || !SLUG_RE.test(slug)) throw new Error("Slug must be lowercase letters, digits and dashes.");
    input.slug = slug;
  }

  if (body.description !== undefined) {
    if (body.description === null) input.description = null;
    else if (typeof body.description !== "string") throw new Error("Description must be text.");
    else {
      const description = body.description.trim();
      if (description.length > 600) throw new Error("Description must be at most 600 characters.");
      input.description = description || null;
    }
  }

  if (body.logo_path !== undefined || body.logoPath !== undefined) {
    const raw = body.logo_path ?? body.logoPath;
    if (raw === null) input.logoPath = null;
    else if (typeof raw !== "string") throw new Error("Logo path must be text.");
    else {
      const logo = raw.trim();
      if (logo.length > 300) throw new Error("Logo path must be at most 300 characters.");
      if (/^(javascript|data):/i.test(logo)) throw new Error("Logo path must be an image path or URL.");
      input.logoPath = logo || null;
    }
  }

  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0 || position > 999) {
      throw new Error("Position must be a whole number between 0 and 999.");
    }
    input.position = position;
  }

  return input;
}

/** Reads `categoryIds` (array of category ids) when present. */
function readCategoryIds(body: Record<string, unknown>): string[] | undefined {
  const raw = body.categoryIds ?? body.category_ids;
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new Error("Category links must be a list of category ids.");
  return raw.map(value => {
    if (typeof value !== "string" || !UUID_RE.test(value.trim())) {
      throw new Error("Category links must be valid category ids.");
    }
    return value.trim();
  });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const withCategories = url.searchParams.get("withCategories") === "1";

  try {
    const { rows, total } = await listBrands(db, { page, limit });
    if (!withCategories) return NextResponse.json({ brands: rows, total, page, limit });

    const brands = await Promise.all(
      rows.map(async brand => ({
        ...brand,
        category_ids: await listBrandCategoryIds(db, brand.id)
      }))
    );
    return NextResponse.json({ brands, total, page, limit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load brands.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  let body: Record<string, unknown>;
  let categoryIds: string[] | undefined;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("The request body must be a JSON object.", 400);
    }
    body = parsed as Record<string, unknown>;
    categoryIds = readCategoryIds(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The request body must be JSON.", 400);
  }

  let input;
  try {
    input = readBrandInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid brand data.", 400);
  }
  if (!input.name) return fail("Brand name is required.", 400);
  if (!input.slug) return fail("Slug is required.", 400);

  try {
    const existing = await getBrandBySlug(db, input.slug);
    if (existing) return fail("A brand with that slug already exists.", 409);

    const row = await createBrand(db, { ...input, name: input.name, slug: input.slug });
    if (categoryIds && categoryIds.length > 0) {
      await setBrandCategories(db, row.id, categoryIds);
    }
    return NextResponse.json(
      { ...row, category_ids: categoryIds ?? [] },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The brand could not be created.";
    if (message.includes("slug") && message.includes("already")) {
      return fail("A brand with that slug already exists.", 409);
    }
    if (message.includes("name") && message.includes("already")) {
      return fail("A brand with that name already exists.", 409);
    }
    return fail(message, 500);
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Brand id is required.");

  let body: Record<string, unknown>;
  let categoryIds: string[] | undefined;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("The request body must be a JSON object.", 400);
    }
    body = parsed as Record<string, unknown>;
    categoryIds = readCategoryIds(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The request body must be JSON.", 400);
  }

  let input;
  try {
    input = readBrandInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid brand data.", 400);
  }

  try {
    const row = await updateBrand(db, id, input);
    if (categoryIds !== undefined) {
      await setBrandCategories(db, id, categoryIds);
    }
    return NextResponse.json({
      ...row,
      category_ids: categoryIds ?? (await listBrandCategoryIds(db, id))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The brand could not be updated.";
    if (message.includes("slug") && message.includes("already")) {
      return fail("A brand with that slug already exists.", 409);
    }
    if (message.includes("name") && message.includes("already")) {
      return fail("A brand with that name already exists.", 409);
    }
    return fail(message, 500);
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Brand id is required.");

  try {
    await deleteBrand(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("foreign key")) {
      return fail("This brand is still used by products.", 409);
    }
    return fail(
      error instanceof Error ? error.message : "The brand could not be deleted.",
      500
    );
  }
}
