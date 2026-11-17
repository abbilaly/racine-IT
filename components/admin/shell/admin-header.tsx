"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/admin/ui/button";
import { AdminThemeToggle } from "@/components/admin/theme/theme-toggle";
import { breadcrumbsFor } from "./nav-items";
import { UserMenu } from "./user-menu";

export function AdminHeader({
  email,
  role,
  onOpenMobile
}: {
  email: string;
  role: string;
  onOpenMobile: () => void;
}) {
  const pathname = usePathname() ?? "/admin";
  const crumbs = breadcrumbsFor(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 font-sans backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4 lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobile}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="size-5"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </Button>

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="m-0 flex list-none items-center gap-1 p-0 text-[13px]">
          <li className="flex items-center">
            <Link
              href="/admin"
              aria-label="Dashboard"
              className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Home size={15} aria-hidden="true" />
            </Link>
          </li>
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-muted-foreground/60" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded px-1 py-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate px-1 font-medium text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <AdminThemeToggle />
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}
