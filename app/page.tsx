import HomeView from "@/components/HomeView";
import { requireCatalog } from "@/lib/server/catalog";

/**
 * Storefront home page.
 *
 * Catalogue-backed: the page fails visibly when the catalogue database is
 * unreachable, instead of presenting the bundled seed catalogue as current stock
 * and pricing. The interactive body lives in `components/HomeView.tsx`.
 */
export default async function HomePage() {
  await requireCatalog();

  return <HomeView />;
}
