"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/quotations", label: "Quotations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="admin-nav">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`admin-nav-link ${active ? "is-active" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Breadcrumbs now live in the admin shell header, derived from the URL, so
 * page-level copies would duplicate them. The export stays so existing pages
 * keep compiling; it intentionally renders nothing.
 */
export function AdminBreadcrumbs(_props: {
  items: Array<{ label: string; href?: string }>;
}) {
  return null;
}
