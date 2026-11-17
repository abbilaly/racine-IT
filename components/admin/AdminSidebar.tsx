"use client";

import Link from "next/link";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./shell/sidebar-nav";
import { LogoutForm } from "./shell/logout-form";

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (letters || "AB").toUpperCase();
}

/**
 * Desktop navigation rail. Collapses to an icon rail; the mobile drawer lives
 * in AdminShell so this component stays a single-purpose aside.
 */
export function AdminSidebar({
  collapsed,
  onToggle,
  email,
  role
}: {
  collapsed: boolean;
  onToggle: () => void;
  email: string;
  role: string;
}) {
  return (
    <aside
      aria-label="Admin navigation"
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col bg-[#100024] font-sans text-white lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[264px]"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-white/[0.07]",
          collapsed ? "justify-center px-0" : "gap-2.5 px-4"
        )}
      >
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="AB Tech admin dashboard"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[11px] font-bold tracking-wide text-[#c9bdf5]">
            AB
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-white">AB Tech</span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-white/40">Admin</span>
            </span>
          )}
        </Link>
      </div>

      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", collapsed ? "px-2" : "px-3")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
            {initials(email)}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-medium text-white/90" title={email}>
                {email}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.1em] text-white/40">{role}</span>
            </span>
          )}
          {!collapsed && (
            <LogoutForm>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="grid size-8 place-items-center rounded-md border-0 bg-transparent text-white/45 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <LogOut size={15} aria-hidden="true" />
              </button>
            </LogoutForm>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-[11px] font-medium text-white/40",
            "transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose size={15} aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
