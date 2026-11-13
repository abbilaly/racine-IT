import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { createStockAdjustment } from "@/lib/server/admin-data";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

  let body: { inventoryId?: unknown; productId?: unknown; variantId?: unknown; change?: unknown; reason?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const inventoryId = typeof body.inventoryId === "string" ? body.inventoryId.trim() : undefined;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const variantId = typeof body.variantId === "string" ? body.variantId.trim() : undefined;
  const change = typeof body.change === "number" ? body.change : NaN;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : undefined;

  if (!productId) return fail("Product id is required.", 400);
  if (!Number.isFinite(change)) return fail("Stock change must be a number.", 400);
  if (!Number.isInteger(change)) return fail("Stock change must be a whole number.", 400);
  if (change === 0) return fail("Stock change must not be zero.", 400);
  if (reason.length < 1 || reason.length > 120) {
    return fail("Reason must be between 1 and 120 characters.", 400);
  }

  try {
    const row = await createStockAdjustment(db, session, {
      inventory_id: inventoryId ?? null,
      product_id: productId,
      variant_id: variantId ?? null,
      change,
      reason,
      note: note ?? null,
    });
    return NextResponse.json({
      id: row.id,
      inventory_id: row.inventory_id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      change: row.change,
      reason: row.reason,
      note: row.note,
      adjusted_by: row.adjusted_by,
      created_at: row.created_at,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not record stock adjustment.", 500);
  }
}
