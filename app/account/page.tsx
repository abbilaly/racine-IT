import Link from "next/link";
import { CircleUserRound, GitCompareArrows, Heart, ShoppingBag } from "lucide-react";
import OrderLookup from "@/components/OrderLookup";
import { CONTACT } from "@/lib/site-config";
import { registrationMode } from "@/lib/server/auth";

const ENTRIES = [
  {
    href: "/cart",
    icon: ShoppingBag,
    title: "Your cart",
    text: "Review items, quantities and totals before you check out.",
  },
  {
    href: "/wishlist",
    icon: Heart,
    title: "Wishlist",
    text: "Products you saved for later on this device.",
  },
  {
    href: "/compare",
    icon: GitCompareArrows,
    title: "Compare list",
    text: "Side-by-side specs for the products you picked.",
  },
  {
    href: "/shop",
    icon: CircleUserRound,
    title: "Continue shopping",
    text: "Browse all products, deals and categories.",
  },
];

export const metadata = {
  title: "Account — AB Tech",
  description: "Account entry point for the AB Tech storefront.",
};

export default function AccountPage() {
  // Only offer account creation when this deployment can actually create a
  // customer (CUSTOMER_ALLOW_REGISTRATION=1). Otherwise the CTA would lead to a
  // form that can only fail. Guest checkout is available either way.
  const registrationOpen = registrationMode() !== "disabled";

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Account</span>
      </nav>

      <div className="page-heading">
        <h1>Account</h1>
        <p>Sign in to view your orders, save your details and check the status of your purchases.</p>
      </div>

      <div className="account-grid">

        <section className="account-section">
          <h2>Sign in to your account</h2>
          <p>
            Have an AB Tech account already? Sign in with your email and password. Guest checkout is always
            available — you never have to create an account to buy from us.
          </p>
          <div className="account-actions">
            <Link href="/account/signin" className="btn btn-primary">
              Sign in
            </Link>
          </div>
        </section>

        <section className="account-section">
          <h2>{registrationOpen ? "Create an account" : "Accounts are coming soon"}</h2>
          {registrationOpen ? (
            <>
              <p>
                Create an AB Tech account to save your details, see your order history and manage your profile.
                You can also sign up with Google when that option is available.
              </p>
              <div className="account-actions">
                <Link href="/account/signup" className="btn btn-primary">
                  Create account
                </Link>
                <div className="account-google-note">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.82 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Google sign-up will be available soon.</span>
                </div>
              </div>
            </>
          ) : (
            <p>
              Online account creation is not open yet — you can still check out as a guest and keep the
              order reference from your confirmation page. If you need an account now, email{" "}
              <a href={`mailto:${CONTACT.email}`} className="link-underline">{CONTACT.email}</a> and we
              will set one up.
            </p>
          )}
        </section>

      </div>

      <section className="account-section">
        <h2>Find your order</h2>
        <p>
          Orders are stored on the server, not just in this browser. Enter the reference from your
          confirmation page — for example <b>RIT-AB12CD34</b> — to reopen one. Orders placed today
          are guest orders, so keep that reference: they are not yet linked to an account.
        </p>
        <OrderLookup />
        <Link href="/checkout" className="btn btn-outline" style={{width:'100%',justifyContent:'center'}}>
          Go to checkout
        </Link>
      </section>

      <section className="account-section">
        <h2>Need a hand?</h2>
        <p>
          Email {CONTACT.email} or call {CONTACT.phone} and our team will get back to you.
        </p>
        <p className="muted-note">{CONTACT.disclaimer}</p>
      </section>
    </main>
  );
}
