/**
 * Customer-aware order creation and lookup.
 *
 * OWNERSHIP STATUS (MVP): not supported yet. `create_order()` on the deployed
 * database takes five parameters and has no `p_user_id`, so no order can be
 * attributed to a customer account; every checkout, signed in or not, creates a
 * guest order (orders.user_id = NULL). `createCustomerOrder` therefore refuses
 * to run until migration 0006 is applied and `ORDER_OWNERSHIP_ENABLED` in
 * lib/server/orders.ts is turned on. Nothing here invents a user id, and no
 * screen promises account-linked orders.
 *
 * What does work today: order *reads* for customers go through the customer's
 * own token client, so RLS is the real boundary and a customer can only see
 * orders that RLS attributes to them.
 */

import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ORDER_OWNERSHIP_ENABLED, createOrderSupabase } from "@/lib/server/orders";
import type { CreateOrderRequest, CreateOrderResponse, StoredOrder } from "@/lib/orders";
import type { CustomerSession } from "@/lib/server/customer-auth";

/**
 * Place an order on behalf of a signed-in customer. The order's owner is the
 * verified server-side customer UUID from the session, written atomically during
 * order creation on the Supabase path.
 */
export async function createCustomerOrder(
  session: CustomerSession,
  request: CreateOrderRequest,
  options?: { customerUserId?: string }
): Promise<CreateOrderResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured for this environment.");
  }

  if (!session.userId) {
    throw new Error("A verified customer session is required to place this order.");
  }

  if (!ORDER_OWNERSHIP_ENABLED) {
    // Sending an order without its owner would silently mis-file it against the
    // customer's expectations, so this path stays closed until 0006 is live.
    throw new Error(
      "Customer order ownership is not enabled yet. Use guest checkout until migration 0006 is applied."
    );
  }

  const customerUserId = options?.customerUserId ?? session.userId;

  const order = await createOrderSupabase(
    request,
    customerUserId
  );

  return order;
}

/**
 * Returns the current customer's orders, or null when not signed in / Supabase
 * is not configured. Reads go through the customer's own token so RLS enforces
 * that a customer only ever sees their own orders.
 */
export async function listCustomerOrders(
  session: CustomerSession,
  pagination?: { page?: number; limit?: number }
): Promise<{ orders: StoredOrder[]; total: number }> {
  if (!isSupabaseConfigured() || !session.userId) {
    return { orders: [], total: 0 };
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return { orders: [], total: 0 };
  }

  const customerDb = (await import("@/lib/supabase/server")).createUserClient(session.accessToken);
  const offset = (Math.max(1, parseInt(String(pagination?.page ?? 1), 10)) - 1) * Math.min(100, Math.max(1, parseInt(String(pagination?.limit ?? 20), 10)));
  const limit = Math.min(100, Math.max(1, parseInt(String(pagination?.limit ?? 20), 10)));

  const { data, error, count } = await customerDb
    .from("orders")
    .select("*, order_items(*), user_id", { count: "exact" })
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    orders: rows.map(normaliseOrder),
    total: count ?? rows.length
  };
}

/**
 * Returns one customer order by id, or null if it does not belong to the customer
 * or does not exist. Reads go through the customer's own token.
 */
export async function getCustomerOrder(
  session: CustomerSession,
  orderId: string
): Promise<StoredOrder | null> {
  if (!isSupabaseConfigured() || !session.userId) {
    return null;
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return null;
  }

  const customerDb = (await import("@/lib/supabase/server")).createUserClient(session.accessToken);
  const { data, error } = await customerDb
    .from("orders")
    .select("*, order_items(*), user_id")
    .eq("id", orderId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  return normaliseOrder(data as Record<string, unknown>);
}

// Normalises a PostgREST order row (with embedded order_items) into StoredOrder.
function normaliseOrder(row: Record<string, unknown>): StoredOrder {
  const items = ((row.order_items as unknown) as Array<{
    slug: string;
    title: string;
    unit_price: number;
    qty: number;
    line_total: number;
    variant_name: string | null;
  }>) ?? [];

  return {
    id: row.id as string,
    ref: row.ref as string,
    status: row.status as string,
    itemCount: row.item_count as number,
    subtotal: row.subtotal as number,
    shipping: row.shipping as number,
    total: row.total as number,
    createdAt: row.created_at as string,
    delivery: row.delivery as "standard" | "express",
    payment: row.payment as "card" | "paypal" | "cod",
    note: row.note as string | null,
    customer: {
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: row.phone as string,
      address: row.address as string,
      city: row.city as string,
      postal: row.postal as string,
      country: row.country as string
    },
    items: items.map(item => ({
      slug: item.slug,
      title: item.title,
      unitPrice: item.unit_price,
      qty: item.qty,
      lineTotal: item.line_total,
      variantName: item.variant_name ?? null
    }))
  };
}
