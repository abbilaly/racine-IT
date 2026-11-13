"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

type SectionLink = { href: string; label: string; exact?: boolean };

const LINKS: ReadonlyArray<SectionLink> = [
  { href: "/admin/emails", label: "Overview", exact: true },
  { href: "/admin/emails/history", label: "History" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/followups", label: "Follow-ups" },
  { href: "/admin/webhooks", label: "Webhooks" },
];

const EMAIL_CENTER_ROOTS = [
  "/admin/emails",
  "/admin/templates",
  "/admin/campaigns",
  "/admin/followups",
  "/admin/webhooks",
];

/**
 * Section tabs shown on mobile and tablet, where the desktop sidebar is
 * collapsed into a horizontal strip. Hidden at desktop widths by CSS, so the
 * existing sidebar remains the only navigation there.
 */
export function EmailCenterNav() {
  const pathname = usePathname() ?? "";

  // Email Center needs migration 0005; when it is not applied the section is
  // hidden from the admin navigation entirely.
  if (!EMAIL_CENTER_ENABLED) return null;

  const inEmailCenter = EMAIL_CENTER_ROOTS.some(
    root => pathname === root || pathname.startsWith(`${root}/`)
  );
  if (!inEmailCenter) return null;

  const active = LINKS.filter(link =>
    link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="ec-tabs" aria-label="Email Center sections">
      {LINKS.map(link => {
        const isActive = active?.href === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`ec-tab${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
