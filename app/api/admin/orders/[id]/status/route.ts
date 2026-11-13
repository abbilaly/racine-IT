import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";

const ALLOWED = new Set(["received", "processing", "shipped", "delivered", "cancelled"]);

/**
 * PATCH { status } — controlled order status workflow.
 * Only the known status values are accepted; nothing else about the order
 * (prices, customer data, totals) can be changed through this endpoint.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.status !== "string" || !ALLOWED.has(body.status)) {
    return NextResponse.json(
      { error: "Status must be one of: received, processing, shipped, delivered, cancelled." },
      { status: 400 }
    );
  }

  const db = getAdminClient(session);
  const { data, error } = await db
    .from("orders")
    .update({ status: body.status })
    .eq("id", id)
    .select("id, ref, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order: data });
}