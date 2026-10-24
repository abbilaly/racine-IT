import Link from "next/link";
import WishlistGrid from "@/components/WishlistGrid";

export const metadata = {
  title: "Wishlist — Racine IT",
  description: "Products you have saved for later."
};

export default function WishlistPage() {
  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Wishlist</span>
      </nav>
      <WishlistGrid />
    </main>
  );
}
