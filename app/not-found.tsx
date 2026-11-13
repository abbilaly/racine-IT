import Link from "next/link";

export const metadata = {
  title: "Page not found — AB Tech",
  robots: { index: false, follow: false }
};

/**
 * Global 404. Kept deliberately simple and on-brand: the visitor either mistyped
 * a URL or followed an outdated link.
 */
export default function NotFound() {
  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Page not found</span>
      </nav>

      <div className="empty-state">
        <h2>We could not find that page</h2>
        <p>
          The page may have moved or the link may be out of date. Everything in the store is still
          available from the shop.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/shop" className="btn-dark">
            Browse the shop
          </Link>
          <Link href="/account" className="btn btn-outline">
            Track an order
          </Link>
        </div>
      </div>
    </main>
  );
}
