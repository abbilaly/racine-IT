import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { getCustomerOrder } from "@/lib/server/orders-customer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to view this order." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const order = await getCustomerOrder(session, id);
    if (!order) {
      return NextResponse.json({ error: "That order was not found or is not yours." }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Failed to load customer order", error);
    return NextResponse.json({ error: "We could not load that order right now." }, { status: 503 });
  }
}
