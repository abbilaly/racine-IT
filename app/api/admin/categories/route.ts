import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listCategories, createCategory, updateCategory, deleteCategory, getCategoryBySlug, CategoryRow } from "@/lib/server/admin-data";

type CategoryJson = { id: string; slug: string; label: string; description: string | null; position: number };


function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }
  try {
    const rows = await listCategories(db);
    return NextResponse.json({ categories: rows as CategoryRow[] });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load categories.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  let body: { slug?: unknown; label?: unknown; description?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;

  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return fail("Slug must be lowercase letters, digits and dashes.", 400);
  }
  if (!label || label.length > 60) {
    return fail("Label must be between 1 and 60 characters.", 400);
  }

  try {
    const existing = await getCategoryBySlug(db, slug);
    if (existing) return fail("A category with that slug already exists.", 409);
    const row = await createCategory(db, { slug, label, description });
    return NextResponse.json({ id: row.id, slug: row.slug, label: row.label, description: row.description, position: row.position ?? 0 } satisfies CategoryJson, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The category could not be created.";
    if (message.includes("slug") && message.includes("already")) {
      return fail("A category with that slug already exists.", 409);
    }
    return fail(message, 500);
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Category id is required.");

  let body: { label?: unknown; description?: unknown; position?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const label =
    typeof body.label === "string" ? body.label.trim() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const position =
    typeof body.position === "number" ? body.position : undefined;

  if (label !== undefined && (!label || label.length > 60)) {
    return fail("Label must be between 1 and 60 characters.", 400);
  }

  try {
    // read current row first so unchanged fields are preserved
    const current = await listCategories(db).then(
      (rows) => rows.find((r) => r.id === id)
    );
    if (!current) return fail("Category not found.", 404);

    const row = await updateCategory(db, id, {
      label: label ?? current.label,
      description: description !== undefined ? description : (current.description ?? null),
      position: position !== undefined ? position : (current.position ?? 0),
    });
    const json: CategoryJson = {
      id: row.id,
      slug: row.slug,
      label: row.label,
      description: row.description ?? null,
      position: row.position ?? 0,
    };
    return NextResponse.json(json);
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

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Category id is required.");

  try {
    await deleteCategory(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("foreign key")) {
      return fail("This category is still used by products.", 409);
    }
    return fail(
      error instanceof Error ? error.message : "The category could not be deleted.",
      500
    );
  }
}
