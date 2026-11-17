"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle
} from "@/components/admin/ui/sheet";
import { AdminHeader } from "./admin-header";
import { LogoutForm } from "./logout-form";
import { SidebarNav } from "./sidebar-nav";

const SIDEBAR_KEY = "ab-admin-sidebar";

/**
 * Admin chrome: desktop rail, sticky header, mobile navigation sheet.
 *
 * Only presentation state lives here (collapsed rail, drawer open). Page data
 * stays in the server components, so nothing about fetching or authorization
 * moves to the client.
 */
export function AdminShell({
  email,
  role,
  children
}: {
  email: string;
  role: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      // Preference is optional.
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Preference is optional.
      }
      return next;
    });
  }

  return (
    <>
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[#100024] focus:shadow-lg"
      >
        Skip to content
      </a>

      <AdminSidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        email={email}
        role={role}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader email={email} role={role} onOpenMobile={() => setMobileOpen(true)} />
        <main id="admin-content" className="admin-main min-w-0 flex-1">
          {children}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[286px] gap-0 border-0 bg-[#100024] p-0 text-white [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-white/60 [&>button]:hover:text-white"
        >
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Sections of the AB Tech admin dashboard
          </SheetDescription>

          <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.07] px-4">
            <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-[11px] font-bold text-[#c9bdf5]">
              AB
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-white">AB Tech</span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-white/40">Admin</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>

          <div className="border-t border-white/[0.07] p-3">
            <div className="mb-2 truncate px-1 text-[12px] text-white/60" title={email}>
              {email}
            </div>
            <LogoutForm>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </LogoutForm>
            <Link
              href="/"
              className="mt-1 flex w-full items-center rounded-md px-2 py-2 text-[12px] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              View storefront
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
