import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listOrders, createAdminNote, listAdminNotes } from "@/lib/server/admin-data";
import { sendEmail } from "@/lib/server/email";
import { orderConfirmationTemplate } from "@/lib/server/email-templates";
import { deliveryLabel } from "@/lib/server/orders";

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const q = searchParams.get("q") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const db = getAdminClient(session);

  const { rows, total } = await listOrders(db, { status, q, from, to, page, limit });

  const activePage = Math.max(1, page);
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    orders: rows,
    total,
    page: activePage,
    totalPages,
    limit,
  });
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const action = searchParams.get("action");

  const db = getAdminClient(session);

  if (action === "add-note") {
    let body: { note: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: "Order id is required" }, { status: 400 });
    }

    if (!body.note || body.note.trim().length === 0) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    try {
      const note = await createAdminNote(db, session, {
        subject_type: "orders",
        subject_id: orderId,
        note: body.note.trim(),
      });

      return NextResponse.json(note, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
    }
  }

  if (action === "get-notes") {
    if (!orderId) {
      return NextResponse.json({ error: "Order id is required" }, { status: 400 });
    }

    try {
      const { rows: notes, total } = await listAdminNotes(db, "orders", orderId, { page: 1, limit: 100 });
      return NextResponse.json({ notes, total });
    } catch (error) {
      return NextResponse.json({ error: "Failed to get notes" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
