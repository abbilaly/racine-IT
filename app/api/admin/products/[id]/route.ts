import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";
import { parseProductPayload, updateProduct } from "@/lib/server/product-write";

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

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await context.params;
  if (!id) return fail("Product id is required.");

  let parsed;
  try {
    parsed = parseProductPayload(await request.json());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid product data.");
  }

  const db = adminClient(session);
  try {
    const found = await updateProduct(db, id, parsed);
    if (!found) return fail("That product no longer exists.", 404);
    return NextResponse.json({ id, slug: parsed.slug });
  } catch (error) {
    return handleError(error);
  }
}