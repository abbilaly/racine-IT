import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getInventoryForProduct, listStockAdjustments } from "@/lib/server/admin-data";

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
  const productId = url.searchParams.get("productId");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  try {
    if (productId) {
      const inventory = await getInventoryForProduct(db, productId);
      return NextResponse.json({ inventory });
    }

    const { rows, total } = await listStockAdjustments(db, undefined, { page, limit });
    return NextResponse.json({ adjustments: rows, total });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load inventory.", 500);
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

  let body: { productId?: unknown; variantId?: unknown; onHand?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const variantId = typeof body.variantId === "string" ? body.variantId.trim() : undefined;
  const onHand = typeof body.onHand === "number" ? body.onHand : NaN;

  if (!productId) return fail("Product id is required.", 400);
  if (!Number.isFinite(onHand) || !Number.isInteger(onHand) || onHand < 0) {
    return fail("On-hand stock must be a whole number of 0 or more.", 400);
  }

  try {
    const result = await db.from("inventory").update({ on_hand: onHand }).eq("product_id", productId).is("variant_id", variantId ?? null).select("id, product_id, variant_id, on_hand, updated_at");
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ updated: result.data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update inventory.", 500);
  }
}
