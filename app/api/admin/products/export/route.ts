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

const CSV_HEADER = [
  "id",
  "slug",
  "title",
  "category",
  "price",
  "compare_at_price",
  "stock",
  "badge",
  "is_active",
  "short_description",
  "created_at",
].join(",");

function escapeCsv(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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
  const q = url.searchParams.get("q")?.trim() ?? undefined;
  const category = url.searchParams.get("category")?.trim() ?? undefined;
  const statusParam = url.searchParams.get("status");
  let status: "active" | "hidden" | "all" | undefined;
  if (statusParam === "active") status = "active";
  else if (statusParam === "hidden") status = "hidden";

  try {
    // one page of at most 500 products keeps the Worker response bounded.
    const { rows: list } = await listProducts(db, {
      page: 1,
      limit: 500,
      q,
      category,
      status,
    });

    // fetch detailed rows so the CSV includes exact stock and category names.
    const detailedRows = await Promise.all(
      list.map(async (row) => {
        const detail = await getProductDetail(db, row.id);
        return {
          id: row.id,
          slug: row.slug,
          title: row.title,
          category: detail?.category?.label ?? "",
          price: row.price_cents / 100,
          compare_at_price: row.compare_at_price_cents == null ? "" : row.compare_at_price_cents / 100,
          stock: detail?.stock ?? 0,
          badge: row.badge ?? "",
          is_active: row.is_active ? "active" : "hidden",
          short_description: row.short_description,
          created_at: row.created_at,
        };
      })
    );

    const lines = detailedRows.map((row) =>
      [
        row.id,
        row.slug,
        row.title,
        row.category,
        row.price,
        row.compare_at_price,
        row.stock,
        row.badge,
        row.is_active,
        row.short_description,
        row.created_at,
      ]
        .map(escapeCsv)
        .join(",")
    );

    const body = [CSV_HEADER, ...lines].join("\r\n");

    const filename = `products_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not export products.", 500);
  }
}
