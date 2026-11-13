import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  listProducts,
  getProductDetail,
} from "@/lib/server/admin-data";
import type { AdminClient } from "@/lib/server/admin-client";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: AdminClient;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const q = url.searchParams.get("q")?.trim() ?? undefined;
  const category = url.searchParams.get("category")?.trim() ?? undefined;
  const status = url.searchParams.get("status") === "active"
    ? "active"
    : url.searchParams.get("status") === "hidden"
      ? "hidden"
      : "all";

  try {
    const { rows, total } = await listProducts(db, { page, limit, q, category, status });
    return NextResponse.json({ products: rows, total, page, limit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load products.", 500);
  }
}

export async function POST(request: Request) {
  // Product creation is intentionally still done through the existing
  // /api/admin/products POST, which supports image upload. This endpoint is
  // kept for future advanced bulk actions once the UI calls it.
  return NextResponse.json({ error: "Use /api/admin/products for product changes." }, { status: 405 });
}
