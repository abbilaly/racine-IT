import type { AdminClient } from "@/lib/server/admin-client";

/**
 * Product lookups shared by admin routes (slug uniqueness checks,
 * category validation). All functions take the RLS-scoped admin client.
 */

export async function getProductBySlug(
  db: AdminClient,
  slug: string
): Promise<{ id: string; slug: string } | null> {
  const { data, error } = await db
    .from("products")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; slug: string } | null) ?? null;
}

export async function getProductById(
  db: AdminClient,
  id: string
): Promise<{ id: string; slug: string; title: string } | null> {
  const { data, error } = await db
    .from("products")
    .select("id, slug, title")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; slug: string; title: string } | null) ?? null;
}

/**
 * True when `slug` is already used by a different product than `excludeId`.
 * Used by the live slug check in the product form.
 */
export async function slugTaken(
  db: AdminClient,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await getProductBySlug(db, slug);
  if (!existing) return false;
  return existing.id !== excludeId;
}