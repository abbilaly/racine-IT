import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  listCategories,
  categoryProductCounts,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  type CategoryRow,
  type CategoryInput
} from "@/lib/server/admin-data";

type CategoryJson = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  position: number;
  is_active: boolean;
  parent_id: string | null;
  icon: string | null;
  banner_path: string | null;
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ICON_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toJson(row: CategoryRow): CategoryJson {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    position: row.position,
    is_active: row.is_active,
    parent_id: row.parent_id,
    icon: row.icon,
    banner_path: row.banner_path
  };
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

function readOptionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} must be at most ${max} characters.`);
  return trimmed || null;
}

/** Reads the shared category fields from a request body. */
function readCategoryInput(body: Record<string, unknown>): CategoryInput {
  const input: CategoryInput = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string") throw new Error("Label must be text.");
    const label = body.label.trim();
    if (!label || label.length > 60) throw new Error("Label must be between 1 and 60 characters.");
    input.label = label;
  }

  const description = readOptionalText(body.description, "Description", 600);
  if (description !== undefined) input.description = description;

  const icon = readOptionalText(body.icon, "Icon", 40);
  if (icon !== undefined) {
    if (icon !== null && !ICON_KEY_RE.test(icon)) {
      throw new Error("Icon must be a lowercase icon key such as laptop or printer.");
    }
    input.icon = icon;
  }

  const bannerPath = readOptionalText(body.banner_path ?? body.bannerPath, "Banner path", 300);
  if (bannerPath !== undefined) {
    if (bannerPath !== null && /^(javascript|data):/i.test(bannerPath)) {
      throw new Error("Banner path must be an image path or URL.");
    }
    input.bannerPath = bannerPath;
  }

  const parentRaw = body.parent_id ?? body.parentId;
  if (parentRaw !== undefined) {
    if (parentRaw === null || parentRaw === "") {
      input.parentId = null;
    } else if (typeof parentRaw === "string" && UUID_RE.test(parentRaw.trim())) {
      input.parentId = parentRaw.trim();
    } else {
      throw new Error("Parent category is not a valid record id.");
    }
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") throw new Error("Visibility must be true or false.");
    input.isActive = body.is_active;
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

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  try {
    const [rows, counts] = await Promise.all([
      listCategories(db),
      categoryProductCounts(db)
    ]);
    return NextResponse.json({ categories: rows, counts: Object.fromEntries(counts) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load categories.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("The request body must be a JSON object.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug || slug.length > 60 || !SLUG_RE.test(slug)) {
    return fail("Slug must be lowercase letters, digits and dashes.", 400);
  }

  let input: CategoryInput;
  try {
    input = readCategoryInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid category data.", 400);
  }
  if (!input.label) return fail("Label is required.", 400);

  try {
    const existing = await getCategoryBySlug(db, slug);
    if (existing) return fail("A category with that slug already exists.", 409);
    const row = await createCategory(db, { ...input, slug, label: input.label });
    return NextResponse.json(toJson(row), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The category could not be created.";
    if (message.includes("slug") && message.includes("already")) {
      return fail("A category with that slug already exists.", 409);
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
  if (!id) return fail("Category id is required.");

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("The request body must be a JSON object.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  let input: CategoryInput;
  try {
    input = readCategoryInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid category data.", 400);
  }

  try {
    const current = await getCategoryById(db, id);
    if (!current) return fail("Category not found.", 404);
    const row = await updateCategory(db, id, input);
    return NextResponse.json(toJson(row));
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The category could not be updated.",
      500
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const connection = asDb(session);
  if (!connection.db) return fail(connection.error ?? "The server is not configured.", 500);
  const db = connection.db;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Category id is required.");

  try {
    await deleteCategory(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The category could not be deleted.";
    if (message.includes("foreign key")) {
      return fail("This category is still used by products.", 409);
    }
    return fail(message, 409);
  }
}
