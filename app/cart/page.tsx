import Link from "next/link";
import CartView from "@/components/CartView";
import { requireCatalog } from "@/lib/server/catalog";

export const metadata = {
  title: "Cart — AB Tech",
  description: "Review the items in your cart before checkout."
};

export default async function CartPage() {
  // Catalogue-backed page: without this the shell's seed fallback would show
  // stale prices as if they were current.
  await requireCatalog();

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Cart</span>
      </nav>
      <div className="page-heading">
        <h1>Shopping Cart</h1>
        <p>Review your items, then head to checkout.</p>
      </div>
      <CartView />
    </main>
  );
}
