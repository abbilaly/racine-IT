import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "Reset password — AB Tech",
  description: "Set a new password for your AB Tech account.",
};

export default function ResetPasswordPage() {
  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account/signin">Sign in</a> <span>/</span> <span aria-current="page">Reset password</span>
      </nav>

      <div className="page-heading">
        <h1>Reset your password</h1>
        <p>Request a reset link, or paste a reset token if you already have one.</p>
      </div>

      <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /><p>Loading…</p></div>}>
        <ResetPasswordForm />
      </Suspense>

      <p className="account-form-footer">
        Remember your password?{" "}
        <a href="/account/signin" className="link-underline">Sign in</a>
      </p>
    </main>
  );
}
