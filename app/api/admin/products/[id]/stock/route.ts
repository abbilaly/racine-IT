import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { createStockAdjustment } from "@/lib/server/admin-data";
import { getProductDetail } from "@/lib/server/admin-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient(session);

  const product = await getProductDetail(db, id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let body: { reason?: string; change?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reason, change, note } = body;

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  if (typeof change !== "number" || !Number.isFinite(change) || change === 0) {
    return NextResponse.json({ error: "Change must be a non-zero number" }, { status: 400 });
  }

  try {
    const adjustment = await createStockAdjustment(db, session, {
      inventory_id: undefined,
      product_id: id,
      variant_id: undefined,
      change,
      reason: reason.trim(),
      note: note?.trim() || null,
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
