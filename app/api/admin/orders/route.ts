import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

const STATUSES = ["received", "processing", "shipped", "delivered", "cancelled"] as const;

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!id) return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Unknown order status." }, { status: 400 });
  }

  const db = adminClient(session);
  const { data, error } = await db
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select("id, ref")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "That order no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id: data.id, ref: data.ref, status });
}
