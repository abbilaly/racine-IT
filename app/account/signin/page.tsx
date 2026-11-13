import { Suspense } from "react";
import SignInForm from "./SignInForm";
import { registrationMode } from "@/lib/server/auth";

export const metadata = {
  title: "Sign in — AB Tech",
  description: "Sign in to your AB Tech account.",
};

export default function SignInPage() {
  // Do not advertise a sign-up route that this deployment cannot honour.
  const registrationOpen = registrationMode() !== "disabled";

  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account">Account</a> <span>/</span> <span aria-current="page">Sign in</span>
      </nav>

      <div className="page-heading">
        <h1>Sign in</h1>
        <p>Welcome back — sign in with the email and password for your AB Tech account.</p>
      </div>

      <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /><p>Loading…</p></div>}>
        <SignInForm />
      </Suspense>

      <p className="account-form-footer">
        {registrationOpen ? (
          <>
            Don&apos;t have an account yet?{" "}
            <a href="/account/signup" className="link-underline">Create an account</a>
          </>
        ) : (
          <>Account creation is not open yet — you can still check out as a guest.</>
        )}
      </p>
    </main>
  );
}
