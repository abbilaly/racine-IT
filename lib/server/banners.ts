import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/server";

export type HomepageBanner = {
  id: string;
  title: string;
  subtitle: string;
  kicker: string;
  image_path: string;
  cta_label: string;
  cta_href: string;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type BannersResult = {
  /** False when migration 0009 has not been applied yet. */
  available: boolean;
  rows: HomepageBanner[];
};

const COLUMNS =
  "id, title, subtitle, kicker, image_path, cta_label, cta_href, is_active, position, created_at, updated_at";

/** PostgREST/Supabase errors that only mean "the table is not there yet". */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /relation .* does not exist|could not find the table/i.test(error.message ?? "");
}

export function bannerImageUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return `/images/${path}`;
}

export async function listBanners(
  db: SupabaseClient,
  options: { activeOnly?: boolean } = {}
): Promise<BannersResult> {
  let query = db.from("homepage_banners").select(COLUMNS).order("position", { ascending: true });
  if (options.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return { available: false, rows: [] };
    throw new Error(error.message);
  }
  return { available: true, rows: (data ?? []) as HomepageBanner[] };
}

/** Public homepage read; never throws, so a missing table cannot break the shop. */
export async function listPublicBanners(): Promise<{ available: boolean; rows: HomepageBanner[] }> {
  const db = getServiceClient();
  if (!db) return { available: false, rows: [] };
  try {
    return await listBanners(db, { activeOnly: true });
  } catch {
    return { available: false, rows: [] };
  }
}

export type BannerInput = {
  title: string;
  subtitle: string;
  kicker: string;
  imagePath: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  position: number;
};

export function normaliseBannerInput(body: Record<string, unknown>): BannerInput {
  const text = (value: unknown, max: number, fallback = "") =>
    typeof value === "string" ? value.trim().slice(0, max) : fallback;

  const title = text(body.title, 120);
  if (!title) throw new Error("A banner title is required.");

  const imagePath = text(body.imagePath, 500);
  if (!imagePath) throw new Error("A banner image is required.");

  const ctaHref = text(body.ctaHref, 500, "/shop") || "/shop";
  if (!/^(\/|https?:\/\/)/i.test(ctaHref)) {
    throw new Error("The destination must start with / or https://.");
  }

  const positionRaw = Number(body.position);
  const position = Number.isFinite(positionRaw) ? Math.max(0, Math.min(999, Math.trunc(positionRaw))) : 0;

  return {
    title,
    subtitle: text(body.subtitle, 300),
    kicker: text(body.kicker, 60),
    imagePath,
    ctaLabel: text(body.ctaLabel, 40, "Shop now") || "Shop now",
    ctaHref,
    isActive: body.isActive !== false,
    position
  };
}

export async function createBanner(db: SupabaseClient, input: BannerInput): Promise<HomepageBanner> {
  const { data, error } = await db
    .from("homepage_banners")
    .insert({
      title: input.title,
      subtitle: input.subtitle,
      kicker: input.kicker,
      image_path: input.imagePath,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
      is_active: input.isActive,
      position: input.position
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as HomepageBanner;
}

export async function updateBanner(
  db: SupabaseClient,
  id: string,
  input: BannerInput
): Promise<HomepageBanner | null> {
  const { data, error } = await db
    .from("homepage_banners")
    .update({
      title: input.title,
      subtitle: input.subtitle,
      kicker: input.kicker,
      image_path: input.imagePath,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
      is_active: input.isActive,
      position: input.position
    })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as HomepageBanner | null) ?? null;
}

export async function deleteBanner(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("homepage_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
