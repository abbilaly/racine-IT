import Link from "next/link";
import CheckoutView from "@/components/CheckoutView";

export const metadata = {
  title: "Checkout — Racine IT",
  description: "Delivery details, delivery method and order summary."
};

export default function CheckoutPage() {
  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span>
        <Link href="/cart">Cart</Link> <span>/</span> <span aria-current="page">Checkout</span>
      </nav>
      <div className="page-heading">
        <h1>Checkout</h1>
        <p>Delivery details, shipping method and order summary.</p>
      </div>
      <CheckoutView />
    </main>
  );
}
