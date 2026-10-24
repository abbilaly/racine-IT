import Link from "next/link";
import { CircleUserRound, GitCompareArrows, Heart, ShoppingBag } from "lucide-react";
import OrderLookup from "@/components/OrderLookup";

const ENTRIES = [
  {
    href: "/cart",
    icon: ShoppingBag,
    title: "Your cart",
    text: "Review items, quantities and totals before you check out."
  },
  {
    href: "/wishlist",
    icon: Heart,
    title: "Wishlist",
    text: "Products you saved for later on this device."
  },
  {
    href: "/compare",
    icon: GitCompareArrows,
    title: "Compare list",
    text: "Side-by-side specs for the products you picked."
  },
  {
    href: "/shop",
    icon: CircleUserRound,
    title: "Continue shopping",
    text: "Browse all products, deals and categories."
  }
];

export const metadata = {
  title: "Account — Racine IT",
  description: "Account entry point for the Racine IT storefront."
};

export default function AccountPage() {
  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Account</span>
      </nav>

      <div className="page-heading">
        <h1>Account</h1>
        <p>Guest session — saved on this device</p>
      </div>

      <div className="account-notice">
        <h2>Accounts aren&apos;t connected yet</h2>
        <p>
          Racine IT runs as a guest storefront today, so there is no sign-in to create or log into —
          anything below is stored in this browser only, not on a server.
        </p>
      </div>

      <div className="account-grid">
        {ENTRIES.map(entry => {
          const Icon = entry.icon;
          return (
            <Link className="account-card" href={entry.href} key={entry.href}>
              <Icon size={22} strokeWidth={1.6} />
              <h3>{entry.title}</h3>
              <p>{entry.text}</p>
            </Link>
          );
        })}
      </div>

      <section className="account-orders">
        <h2>Your orders</h2>
        <p>
          Orders are stored on the server, not just in this browser. Enter the reference from your
          confirmation page — for example <b>RIT-AB12CD34</b> — to reopen one. There is no sign-in
          yet, so that reference is what opens the order.
        </p>
        <OrderLookup />
        <Link href="/checkout" className="btn-outline">Go to checkout</Link>
      </section>

      <section className="account-support">
        <h2>Need a hand?</h2>
        <p>
          Call +222-1800-2628 or email support@example.com — our team is available 24/7.
        </p>
        <p className="muted-note">
          Support hours: 24/7 chat and phone, Monday to Sunday.
        </p>
      </section>
    </main>
  );
}
