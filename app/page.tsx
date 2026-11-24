import HomeView, { type HomeSlide } from "@/components/HomeView";
import { requireCatalog } from "@/lib/server/catalog";
import { isDraftPreview } from "@/lib/products";
import { bannerImageUrl, listPublicBanners } from "@/lib/server/banners";
import { listBestSellers } from "@/lib/server/best-sellers";

/**
 * Storefront home page.
 *
 * Catalogue-backed: the page fails visibly when the catalogue database is
 * unreachable, instead of presenting the bundled seed catalogue as current stock
 * and pricing. The interactive body lives in `components/HomeView.tsx`.
 *
 * Hero slides come from `homepage_banners` when the owner has published any;
 * otherwise HomeView falls back to its built-in slides, so a missing table (or
 * migration not yet applied) never breaks the shop.
 */
export default async function HomePage() {
  const catalog = await requireCatalog();

  const [{ rows }, bestSellers] = await Promise.all([listPublicBanners(), listBestSellers(5)]);
  const slides: HomeSlide[] = rows
    .filter(banner => banner.image_path)
    .map(banner => ({
      image: bannerImageUrl(banner.image_path),
      mobileImage: banner.mobile_image_path ? bannerImageUrl(banner.mobile_image_path) : undefined,
      focusDesktop: banner.focus_desktop ?? undefined,
      focusMobile: banner.focus_mobile ?? undefined,
      kicker: banner.kicker,
      title: banner.title,
      desc: banner.subtitle,
      href: banner.cta_href || "/shop",
      ctaLabel: banner.cta_label || "Shop now"
    }));

  // Owner-curated featured products (products.is_featured).
  const featuredSlugs = catalog.products.filter(product => product.featured).map(product => product.slug);

  // Newest rows, by the timestamp the catalogue records.
  const newArrivalSlugs = catalog.products
    .filter(product => product.createdAt && !isDraftPreview(product))
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5)
    .map(product => product.slug);

  return (
    <HomeView
      slides={slides}
      featuredSlugs={featuredSlugs}
      newArrivalSlugs={newArrivalSlugs}
      bestSellers={bestSellers}
    />
  );
}
