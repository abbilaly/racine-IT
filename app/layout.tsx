import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompareTray from "@/components/CompareTray";
import BottomNav from "@/components/BottomNav";
import { MobileMenu, MobileMenuProvider } from "@/components/MobileMenu";
import { ShopProvider } from "@/lib/shop-store";
import { loadCatalog } from "@/lib/server/catalog";

// The catalogue comes from Supabase, so every request renders against the
// current database state instead of a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Racine IT — Electronics Store",
  description:
    "Racine IT storefront: phones, laptops, tablets, audio and wearables with deals, wishlist and product comparison."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#100024"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog = await loadCatalog();
  return (
    <html lang="en">
      <body>
        <ShopProvider catalog={catalog}>
          <MobileMenuProvider>
            <Header />
            {children}
            <Footer />
            <CompareTray />
            <MobileMenu />
            <BottomNav />
          </MobileMenuProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
