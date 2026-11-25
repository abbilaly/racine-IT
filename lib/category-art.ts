import { ASSET } from "@/lib/products";

/**
 * Category artwork for the storefront category shortcuts.
 *
 * Artwork is optional per category. A slug listed here renders its transparent
 * PNG illustration; every other category keeps its Lucide icon from
 * `lib/category-icons.ts`. Replacing or adding artwork is a one-line change in
 * `CATEGORY_ART` plus the file in `public/images/categories/`, so the homepage
 * category section never has to be touched again.
 *
 * The two illustrations below are the original Electro Pulse category artwork
 * that already ships with this storefront (`public/images/h-electro-pulse-cat-2`
 * and `-3`), cropped out of their decorative ring and re-exported as
 * transparent PNGs. They are the only originals whose subject matches an
 * approved category — the rest of that set is promo badges or products outside
 * the taxonomy — so the remaining categories keep their icons until matching
 * artwork is supplied.
 */
export type CategoryArt = {
  /** File inside `public/images`. */
  file: string;
  /** Transparent PNG served for the tile. */
  width: number;
  height: number;
};

const CATEGORY_ART: Record<string, CategoryArt> = {
  // Laptop illustration — original Electro Pulse category artwork.
  computers: { file: "categories/computers.png", width: 160, height: 160 },
  // Smartphone illustration — original Electro Pulse category artwork.
  smartphones: { file: "categories/smartphones.png", width: 160, height: 160 }
};

/**
 * Artwork for a category slug, or null when the category keeps its icon.
 * Keyed by slug so the mapping survives label changes in the database.
 */
export function categoryArt(slug: string): (CategoryArt & { src: string }) | null {
  const art = CATEGORY_ART[slug];
  if (!art) return null;
  return { ...art, src: `${ASSET}/${art.file}` };
}
