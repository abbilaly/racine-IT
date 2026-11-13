import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";
import { parseProductPayload, createProduct } from "@/lib/server/product-write";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "The product could not be saved.";
  const anyError = error as { code?: string };
  if (anyError?.code === "23505") return fail("That slug is already in use by another product.", 409);
  if (anyError?.code === "23503") return fail("Choose a valid category or brand.", 400);
  return fail(message, 500);
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let parsed;
  try {
    parsed = parseProductPayload(await request.json());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid product data.");
  }

  const db = adminClient(session);
  try {
    const id = await createProduct(db, parsed);
    return NextResponse.json({ id, slug: parsed.slug }, { status: 201 });
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