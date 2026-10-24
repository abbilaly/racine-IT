import Link from "next/link";
import CartView from "@/components/CartView";

export const metadata = {
  title: "Cart — Racine IT",
  description: "Review the items in your cart before checkout."
};

export default function CartPage() {
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
