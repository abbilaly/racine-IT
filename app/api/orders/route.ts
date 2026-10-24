import { NextResponse } from "next/server";
import { OrderError, createOrder } from "@/lib/server/orders";

export async function POST(request: Request) {
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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create order", error);
    return NextResponse.json(
      { error: "We could not save your order. Please try again." },
      { status: 500 }
    );
  }
}
