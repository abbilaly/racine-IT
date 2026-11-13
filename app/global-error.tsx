"use client";

import { useEffect } from "react";

/**
 * Root error boundary. This replaces the root layout when the layout itself
 * fails, so it must render its own <html> and <body> and cannot rely on the
 * application stylesheet.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[global-error] digest=${error.digest ?? "none"}`);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fafafa",
          color: "#111",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px"
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>The store is temporarily unavailable</h1>
          <p style={{ fontSize: 14, color: "#555", margin: "0 0 22px", lineHeight: 1.6 }}>
            We could not load the storefront. If you were in the middle of placing an order, please
            check your order confirmation email or your order reference before trying again — we
            cannot tell from here whether that order went through.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: 4,
              background: "#111",
              color: "#fff",
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            Try again
          </button>
          <p style={{ fontSize: 13, margin: "18px 0 0" }}>
            <a href="/account" style={{ color: "#111" }}>
              Check an order
            </a>
            {" · "}
            <a href="/" style={{ color: "#111" }}>
              Back to the store
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
