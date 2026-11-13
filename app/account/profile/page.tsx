import { Suspense } from "react";
import ProfileContent from "./ProfileContent";

export const metadata = {
  title: "Profile — AB Tech",
  description: "Manage your AB Tech account profile.",
};

export default function ProfilePage() {
  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account">Account</a> <span>/</span> <span aria-current="page">Profile</span>
      </nav>

      <div className="page-heading">
        <h1>Profile</h1>
        <p>Manage your AB Tech account details. Changes are saved to your account and apply across devices.</p>
      </div>

      <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /><p>Loading your account…</p></div>}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}
