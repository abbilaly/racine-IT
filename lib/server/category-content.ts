import { cache } from "react";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Optional category presentation data: hierarchy, icon, description and banner.
 *
 * These columns are introduced by migration 0008_catalogue_presentation.sql,
 * which is NOT applied to production yet. The storefront must therefore keep
 * rendering on the current schema, where `categories` only has
 * slug/label/position. The query is attempted once and, if PostgREST reports a
 * missing column, the storefront simply uses its built-in icon and copy
 * fallbacks. That mirrors the legacy fallback already used by the admin
 * category queries and keeps /shop online either side of the migration.
 */

export type CategoryContent = {
  /** Slug of the parent category, resolved from `parent_id`, or null. */
  parentSlug: string | null;
  /** Icon key chosen by an operator; null means "use the built-in icon". */
  icon: string | null;
  description: string | null;
  bannerPath: string | null;
};

type CategoryContentRow = {
  id: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  description: string | null;
  banner_path: string | null;
};

const CONTENT_COLUMNS = "id,slug,parent_id,icon,description,banner_path";

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(message)
  );
}

export const loadCategoryContent = cache(async function loadCategoryContent(): Promise<
  Map<string, CategoryContent>
> {
  const content = new Map<string, CategoryContent>();
  if (!isSupabaseConfigured()) return content;

  const supabase = getServiceClient();
  if (!supabase) return content;

  const { data, error } = await supabase.from("categories").select(CONTENT_COLUMNS);
  if (error) {
    // Presentation data is optional: a pre-0008 schema must not take /shop down.
    if (!isMissingColumn(error)) {
      console.error("Category presentation data unavailable:", error.message);
    }
    return content;
  }

  const rows = (data ?? []) as CategoryContentRow[];
  const slugById = new Map(rows.map(row => [row.id, row.slug]));

  for (const row of rows) {
    content.set(row.slug, {
      parentSlug: row.parent_id ? (slugById.get(row.parent_id) ?? null) : null,
      icon: row.icon ?? null,
      description: row.description ?? null,
      bannerPath: row.banner_path ?? null
    });
  }

  return content;
});
