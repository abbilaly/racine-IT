"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_SECTIONS } from "./nav-items";

export function SidebarNav({
  collapsed = false,
  onNavigate
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-5 py-2">
      {NAV_SECTIONS.filter(
        section => EMAIL_CENTER_ENABLED || !section.requiresEmailCenter
      ).map(section => (
        <div key={section.title}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              {section.title}
            </p>
          )}
          {collapsed && <div className="mx-auto mb-2 h-px w-8 bg-white/10" aria-hidden="true" />}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {section.items.map(item => {
              const active = isActivePath(pathname, item);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium outline-none",
                      "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white/70",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#a78bfa]"
                      />
                    )}
                    <Icon
                      size={17}
                      strokeWidth={1.9}
                      aria-hidden="true"
                      className={cn("shrink-0", active ? "text-white" : "text-white/55 group-hover:text-white")}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
