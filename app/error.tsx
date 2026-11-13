"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary.
 *
 * Renders inside the root layout (header/footer stay visible) when a page throws
 * — for example when the catalogue database is unreachable and the storefront
 * refuses to serve stale seed products. The raw error message is never shown to
 * the visitor: it can contain database details. The digest is logged so the
 * failure can be traced in deployment logs.
 */
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[route-error] digest=${error.digest ?? "none"}`);
  }, [error]);

  return (
    <main className="site-shell page">
      <div className="empty-state">
        <h2>We could not load this page</h2>
        <p>
          Something went wrong on our side. If you were in the middle of placing an order, please
          check your order confirmation email or your order reference before trying again — we
          cannot tell from here whether that order went through.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn-dark" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/account" className="btn btn-outline">
            Check an order
          </Link>
          <Link href="/" className="btn btn-outline">
            Back to the store
          </Link>
        </div>
      </div>
    </main>
  );
}
