import { Suspense } from "react";
import Link from "next/link";
import SignUpForm from "./SignUpForm";
import { CONTACT } from "@/lib/site-config";
import { registrationMode } from "@/lib/server/auth";

export const metadata = {
  title: "Create account — AB Tech",
  description: "Create an AB Tech account.",
};

export default function SignUpPage() {
  // With registration disabled the form could only ever fail, so the route says
  // so plainly instead of collecting details it cannot use.
  const registrationOpen = registrationMode() !== "disabled";

  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account">Account</a> <span>/</span> <span aria-current="page">Create account</span>
      </nav>

      <div className="page-heading">
        <h1>{registrationOpen ? "Create an account" : "Account creation is not open yet"}</h1>
        <p>
          {registrationOpen
            ? "Create an AB Tech account to save your details, see your order history and manage your profile."
            : "Guest checkout is open and needs no account. We can set up an account for you on request."}
        </p>
      </div>

      {registrationOpen ? (
        <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /><p>Loading…</p></div>}>
          <SignUpForm />
        </Suspense>
      ) : (
        <div className="empty-state">
          <h2>No account needed to buy</h2>
          <p>
            You can check out as a guest and keep the order reference from your confirmation page. To
            have an account created for you, email{" "}
            <a href={`mailto:${CONTACT.email}`} className="link-underline">{CONTACT.email}</a>.
          </p>
          <Link href="/checkout" className="btn-dark">
            Go to checkout
          </Link>
        </div>
      )}

      <p className="account-form-footer">
        Already have an account?{" "}
        <a href="/account/signin" className="link-underline">Sign in</a>
      </p>
    </main>
  );
}
