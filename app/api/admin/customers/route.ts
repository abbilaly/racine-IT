import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listCustomers, getCustomer, getCustomerOrders } from "@/lib/server/admin-data";

/**
 * Customer CRM data, aggregated from real order records.
 * GET                  → paginated customer list (?q=&page=&limit=)
 * GET ?email=...       → one customer profile plus their order history
 */
export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });

  const db = getAdminClient(session);
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const q = url.searchParams.get("q") ?? undefined;

  try {
    if (email) {
      const customer = await getCustomer(db, email);
      if (!customer) return NextResponse.json({ customer: null, orders: [] });
      const { rows: orders, total } = await getCustomerOrders(db, customer.email, { page, limit });
      return NextResponse.json({
        customer: {
          ...customer,
          total_orders: customer.order_count,
          total_spent: customer.total_spent_cents
        },
        orders,
        total_orders: total
      });
    }

    const { rows, total } = await listCustomers(db, { q, page, limit });
    return NextResponse.json({ customers: rows, total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load customers." },
      { status: 500 }
    );
  }
}