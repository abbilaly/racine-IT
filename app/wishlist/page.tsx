import Link from "next/link";
import WishlistGrid from "@/components/WishlistGrid";
import { requireCatalog } from "@/lib/server/catalog";

export const metadata = {
  title: "Wishlist — AB Tech",
  description: "Products you have saved for later."
};

export default async function WishlistPage() {
  // Catalogue-backed page: fail visibly rather than showing seed products.
  await requireCatalog();

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Wishlist</span>
      </nav>
      <WishlistGrid />
    </main>
  );
}
