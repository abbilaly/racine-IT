import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import CompareTray from "@/components/CompareTray";
import BottomNav from "@/components/BottomNav";
import { MobileMenu, MobileMenuProvider } from "@/components/MobileMenu";
import { ShopProvider } from "@/lib/shop-store";
import { loadCatalog } from "@/lib/server/catalog";
import { seedCatalog, type Catalog } from "@/lib/products";

// The catalogue comes from Supabase, so every request renders against the
// current database state instead of a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AB Tech — Electronics Store",
  description:
    "AB Tech storefront: phones, laptops, tablets, audio and wearables with deals, wishlist and product comparison."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#100024"
};

/**
 * Catalogue for the application shell only.
 *
 * The header, footer, cart chrome and compare tray must render even when the
 * catalogue query fails: an outage must not take /admin, /account or /order
 * offline, and the owner has to be able to sign in and manage orders during the
 * very incident that broke the catalogue. So the shell tolerates a failure and
 * falls back to the bundled seed catalogue for chrome-only state (cart badges,
 * wishlist/compare trays, empty-cart lookups).
 *
 * Catalogue-backed pages never rely on this fallback: `/`, `/shop`,
 * `/product/*`, `/cart`, `/checkout`, `/compare` and `/wishlist` call
 * `requireCatalog()` themselves and fail visibly, so stale seed prices are never
 * presented as current.
 */

/**
 * How long the shell waits for the catalogue before rendering with seed chrome.
 * Supabase requests have no short default timeout, so without this bound a
 * stalled query would delay every page — including `/admin`, `/account` and
 * `/order/*` — by the lifetime of that request.
 */
const SHELL_CATALOG_TIMEOUT_MS = 4000;

async function loadShellCatalog(): Promise<Catalog> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const catalogue = loadCatalog();
    // The race below may return first; make sure a late rejection is handled
    // instead of surfacing as an unhandled rejection in the Worker.
    void catalogue.catch(() => {});

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("catalogue-shell-timeout")),
        SHELL_CATALOG_TIMEOUT_MS
      );
    });

    return await Promise.race([catalogue, timeout]);
  } catch {
    return seedCatalog();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog = await loadShellCatalog();
  return (
    <html lang="en">
      <body>
        <ShopProvider catalog={catalog}>
          <MobileMenuProvider>
            <Header />
            {children}
            <Footer categories={catalog.categories} />
            <CompareTray />
            <MobileMenu />
            <BottomNav />
          </MobileMenuProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
