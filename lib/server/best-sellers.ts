import { cache } from "react";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Best sellers from real order data.
 *
 * The homepage must never present an arbitrary product slice as "best selling".
 * Units are counted from `order_items` on orders that were not cancelled, and
 * the list is empty when the store has no sales yet — the section is then
 * hidden instead of showing invented rankings.
 */
export type BestSeller = { slug: string; units: number };

type OrderItemRow = { order_id: string; slug: string | null; qty: number | null };
type OrderRow = { id: string; status: string };

export const listBestSellers = cache(async function listBestSellers(
  limit = 5
): Promise<BestSeller[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServiceClient();
  if (!db) return [];

  try {
    const [itemsResult, ordersResult] = await Promise.all([
      db.from("order_items").select("order_id,slug,qty"),
      db.from("orders").select("id,status")
    ]);
    // Sales data is an enhancement, never a reason to take the homepage down.
    if (itemsResult.error || ordersResult.error) return [];

    const cancelled = new Set(
      ((ordersResult.data ?? []) as OrderRow[])
        .filter(order => order.status === "cancelled")
        .map(order => order.id)
    );

    const unitsBySlug = new Map<string, number>();
    for (const item of (itemsResult.data ?? []) as OrderItemRow[]) {
      if (!item.slug || cancelled.has(item.order_id)) continue;
      const qty = Number(item.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      unitsBySlug.set(item.slug, (unitsBySlug.get(item.slug) ?? 0) + qty);
    }

    return Array.from(unitsBySlug, ([slug, units]) => ({ slug, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, limit);
  } catch {
    return [];
  }
});
