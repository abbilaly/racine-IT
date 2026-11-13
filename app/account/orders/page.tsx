import { Suspense } from "react";
import OrdersContent from "./OrdersContent";

export const metadata = {
  title: "My Orders — AB Tech",
  description: "View your AB Tech order history.",
};

export default function OrdersPage() {
  return (
    <main className="site-shell page account-form-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/account">Account</a> <span>/</span> <span aria-current="page">My Orders</span>
      </nav>

      <div className="page-heading">
        <h1>My Orders</h1>
        <p>
          View your order history and check the status of each order. Orders placed as a guest are not
          shown here — look those up by their reference instead.
        </p>
      </div>

      <Suspense fallback={<div className="account-loading"><div className="account-spinner" aria-hidden="true" /><p>Loading your orders…</p></div>}>
        <OrdersContent />
      </Suspense>
    </main>
  );
}
