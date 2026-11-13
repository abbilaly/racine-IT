import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — AB Tech",
  description: "Reset your AB Tech account password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account/signin">Sign in</a> <span>/</span> <span aria-current="page">Forgot password</span>
      </nav>

      <div className="page-heading">
        <h1>Forgot password?</h1>
        <p>
          Enter the email address for your AB Tech account and we&apos;ll send you a link to set a new
          password.
        </p>
      </div>

      <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /></div>}>
        <ForgotPasswordForm />
      </Suspense>

      <p className="account-form-footer">
        Remember your password?{" "}
        <a href="/account/signin" className="link-underline">Sign in</a>
      </p>
    </main>
  );
}
