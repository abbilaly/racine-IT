import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from "@/lib/server/admin-data";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  try {
    const { rows, total } = await listBrands(db, { page, limit });
    return NextResponse.json({ brands: rows, total, page, limit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load brands.", 500);
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

  let body: {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    logo_path?: unknown;
    position?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;

  if (!name || name.length > 120) {
    return fail("Brand name is required and must be at most 120 characters.", 400);
  }
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return fail("Slug must be lowercase letters, digits and dashes.", 400);
  }

  try {
    const row = await createBrand(db, { name, slug, description: description ?? null });
    return NextResponse.json({ id: row.id, name: row.name, slug: row.slug, description: row.description }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The brand could not be created.";
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

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Brand id is required.");

  let body: {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    logo_path?: unknown;
    position?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  if (name !== undefined && (!name || name.length > 120)) {
    return fail("Brand name must be between 1 and 120 characters.", 400);
  }
  if (slug !== undefined && (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))) {
    return fail("Slug must be lowercase letters, digits and dashes.", 400);
  }

  try {
    // read current row so unchanged fields are not emptied
    const current = await listBrands(db, { page: 1, limit: 1 }).then(
      (rows) => rows.rows.find((r) => r.id === id)
    );
    if (!current) return fail("Brand not found.", 404);

    const row = await updateBrand(db, id, {
      name: name ?? current.name,
      slug: slug ?? current.slug,
      description: description ?? current.description ?? "",
    });
    return NextResponse.json(row);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The brand could not be updated.";
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

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

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
