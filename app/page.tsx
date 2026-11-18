import HomeView, { type HomeSlide } from "@/components/HomeView";
import { requireCatalog } from "@/lib/server/catalog";
import { bannerImageUrl, listPublicBanners } from "@/lib/server/banners";

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
  await requireCatalog();

  const { rows } = await listPublicBanners();
  const slides: HomeSlide[] = rows
    .filter(banner => banner.image_path)
    .map(banner => ({
      image: bannerImageUrl(banner.image_path),
      kicker: banner.kicker,
      title: banner.title,
      desc: banner.subtitle,
      href: banner.cta_href || "/shop",
      ctaLabel: banner.cta_label || "Shop now"
    }));

  return <HomeView slides={slides} />;
}
