import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  salesReport,
  bestSellingProducts,
  lowStockProducts,
  ordersByStatus,
  last30Days,
} from "@/lib/server/admin-data";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const period = url.searchParams.get("period") ?? "last30days";
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const threshold = parseInt(url.searchParams.get("threshold") ?? "5", 10);

  const defaultTo = new Date().toISOString();
  const defaultFrom = last30Days();

  try {
    if (type === "sales") {
      const sales = await salesReport(db, from ?? defaultFrom, to ?? defaultTo);
      return NextResponse.json({ sales });
    }

    if (type === "best-sellers") {
      const best = await bestSellingProducts(db, limit);
      return NextResponse.json({ best });
    }

    if (type === "low-stock") {
      const low = await lowStockProducts(db, threshold);
      return NextResponse.json({ low });
    }

    if (type === "orders-by-status") {
      const orders = await ordersByStatus(db);
      return NextResponse.json({ orders });
    }

    const [
      sales,
      best,
      low,
      orders
    ] = await Promise.all([
      salesReport(db, from ?? defaultFrom, to ?? defaultTo),
      bestSellingProducts(db, limit),
      lowStockProducts(db, threshold),
      ordersByStatus(db),
    ]);

    return NextResponse.json({ sales, best, low, orders });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load reports.", 500);
  }
}
