import { NextResponse } from "next/server";
import { OrderError, createOrder } from "@/lib/server/orders";
import { RATE_LIMITS, checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  // Each accepted order decrements real inventory, so unthrottled creation is
  // both an abuse vector and a stock-destruction vector.
  const limit = checkRateLimit(request, RATE_LIMITS.orderCreate);
  if (!limit.ok) return rateLimitResponse(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  try {
    const order = await createOrder(body);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      // `outcome` lets the checkout tell a definite rejection (safe to retry)
      // apart from an unconfirmed write (a retry could duplicate the order).
      return NextResponse.json(
        { error: error.message, outcome: error.outcome },
        { status: error.status }
      );
    }
    console.error("Failed to create order", error);
    return NextResponse.json(
      { error: "We could not save your order. Please try again.", outcome: "not_created" },
      { status: 500 }
    );
  }
}
