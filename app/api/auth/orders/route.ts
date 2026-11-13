import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { getCustomerOrder, listCustomerOrders } from "@/lib/server/orders-customer";

export async function GET(_request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to view your orders." }, { status: 401 });
  }

  try {
    const { orders, total } = await listCustomerOrders(session);
    return NextResponse.json({ orders, total });
  } catch (error) {
    console.error("Failed to load customer orders", error);
    return NextResponse.json({ error: "We could not load your orders. Please try again." }, { status: 503 });
  }
}
