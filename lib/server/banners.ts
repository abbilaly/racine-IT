import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/server";

export type HomepageBanner = {
  id: string;
  title: string;
  subtitle: string;
  kicker: string;
  image_path: string;
  /** Optional dedicated mobile artwork (0010). Null keeps the desktop image. */
  mobile_image_path: string | null;
  /** CSS object-position for the desktop crop (0010). */
  focus_desktop: string | null;
  /** CSS object-position for the mobile crop (0010). */
  focus_mobile: string | null;
  cta_label: string;
  cta_href: string;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type BannersResult = {
  /** False when the homepage_banners table has not been created yet (0009). */
  available: boolean;
  /** False until 0010 adds the responsive image/focal-point columns. */
  responsive: boolean;
  rows: HomepageBanner[];
};

export const FOCUS_OPTIONS = ["center", "top", "bottom", "left", "right"] as const;
export type FocusOption = (typeof FOCUS_OPTIONS)[number];

const COLUMNS_BASE =
  "id, title, subtitle, kicker, image_path, cta_label, cta_href, is_active, position, created_at, updated_at";

/** 0010 adds mobile artwork and per-breakpoint focal points. */
const COLUMNS_RESPONSIVE = `${COLUMNS_BASE}, mobile_image_path, focus_desktop, focus_mobile`;

/** PostgREST/Supabase errors that only mean "the column/table is not there yet". */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /relation .* does not exist|could not find the table/i.test(error.message ?? "");
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

function normaliseRow(row: Record<string, unknown>): HomepageBanner {
  return {
    ...(row as unknown as HomepageBanner),
    mobile_image_path: typeof row.mobile_image_path === "string" ? row.mobile_image_path : null,
    focus_desktop: typeof row.focus_desktop === "string" ? row.focus_desktop : "center",
    focus_mobile: typeof row.focus_mobile === "string" ? row.focus_mobile : "center"
  };
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
  const query = (columns: string) => {
    let builder = db.from("homepage_banners").select(columns).order("position", { ascending: true });
    if (options.activeOnly) builder = builder.eq("is_active", true);
    return builder;
  };

  const first = await query(COLUMNS_RESPONSIVE);
  if (!first.error) {
    return {
      available: true,
      responsive: true,
      rows: ((first.data ?? []) as unknown as Record<string, unknown>[]).map(normaliseRow)
    };
  }

  if (!isMissingColumn(first.error)) throw new Error(first.error.message);

  // 0009 applied, 0010 not yet: keep the original behaviour with a single image.
  const fallback = await query(COLUMNS_BASE);
  if (fallback.error) {
    if (isMissingTable(fallback.error)) return { available: false, responsive: false, rows: [] };
    throw new Error(fallback.error.message);
  }
  return {
    available: true,
    responsive: false,
    rows: ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map(normaliseRow)
  };
}

/** Public homepage read; never throws, so a missing table cannot break the shop. */
export async function listPublicBanners(): Promise<BannersResult> {
  const db = getServiceClient();
  if (!db) return { available: false, responsive: false, rows: [] };
  try {
    return await listBanners(db, { activeOnly: true });
  } catch {
    return { available: false, responsive: false, rows: [] };
  }
}

export type BannerInput = {
  title: string;
  subtitle: string;
  kicker: string;
  imagePath: string;
  mobileImagePath: string | null;
  focusDesktop: FocusOption;
  focusMobile: FocusOption;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  position: number;
};

function readFocus(value: unknown, fallback: FocusOption): FocusOption {
  return typeof value === "string" && (FOCUS_OPTIONS as readonly string[]).includes(value)
    ? (value as FocusOption)
    : fallback;
}

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
    mobileImagePath: text(body.mobileImagePath, 500) || null,
    focusDesktop: readFocus(body.focusDesktop, "center"),
    focusMobile: readFocus(body.focusMobile, "center"),
    ctaLabel: text(body.ctaLabel, 40, "Shop now") || "Shop now",
    ctaHref,
    isActive: body.isActive !== false,
    position
  };
}

/**
 * Writes a banner, retrying without the 0010 columns when the database has not
 * had that migration applied. The base columns are always written, so a banner
 * is never lost just because its mobile crop cannot be stored yet.
 */
async function writeBanner(
  db: SupabaseClient,
  mode: "insert" | "update",
  payload: Record<string, unknown>,
  id?: string
): Promise<HomepageBanner> {
  const responsive = {
    ...payload,
    mobile_image_path: payload.mobile_image_path,
    focus_desktop: payload.focus_desktop,
    focus_mobile: payload.focus_mobile
  };
  const base: Record<string, unknown> = { ...payload };
  delete base.mobile_image_path;
  delete base.focus_desktop;
  delete base.focus_mobile;

  const attempt = async (values: Record<string, unknown>, columns: string) => {
    if (mode === "insert") {
      return db.from("homepage_banners").insert(values).select(columns).single();
    }
    return db.from("homepage_banners").update(values).eq("id", id!).select(columns).maybeSingle();
  };

  const first = await attempt(responsive, COLUMNS_RESPONSIVE);
  if (!first.error) {
    if (!first.data) throw new Error("Banner not found.");
    return normaliseRow(first.data as unknown as Record<string, unknown>);
  }
  if (!isMissingColumn(first.error)) throw new Error(first.error.message);

  const fallback = await attempt(base, COLUMNS_BASE);
  if (fallback.error) throw new Error(fallback.error.message);
  if (!fallback.data) throw new Error("Banner not found.");
  return normaliseRow(fallback.data as unknown as Record<string, unknown>);
}

export async function createBanner(db: SupabaseClient, input: BannerInput): Promise<HomepageBanner> {
  return writeBanner(db, "insert", {
    title: input.title,
    subtitle: input.subtitle,
    kicker: input.kicker,
    image_path: input.imagePath,
    mobile_image_path: input.mobileImagePath,
    focus_desktop: input.focusDesktop,
    focus_mobile: input.focusMobile,
    cta_label: input.ctaLabel,
    cta_href: input.ctaHref,
    is_active: input.isActive,
    position: input.position
  });
}

export async function updateBanner(
  db: SupabaseClient,
  id: string,
  input: BannerInput
): Promise<HomepageBanner | null> {
  try {
    return await writeBanner(db, "update", {
      title: input.title,
      subtitle: input.subtitle,
      kicker: input.kicker,
      image_path: input.imagePath,
      mobile_image_path: input.mobileImagePath,
      focus_desktop: input.focusDesktop,
      focus_mobile: input.focusMobile,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
      is_active: input.isActive,
      position: input.position
    }, id);
  } catch (error) {
    if (error instanceof Error && error.message === "Banner not found.") return null;
    throw error;
  }
}

export async function deleteBanner(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("homepage_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
