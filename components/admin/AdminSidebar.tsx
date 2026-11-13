"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Settings,
  Users,
  BarChart3,
  FileText,
  Upload,
  Box,
  Mail,
  ChevronRight,
  LogOut,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { EMAIL_CENTER_ENABLED } from "@/lib/site-config";

type NavLinkItem = { href: string; label: string; icon: LucideIcon };
type NavSectionItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  sub: ReadonlyArray<{ href: string; label: string }>;
};

const NAV: ReadonlyArray<NavLinkItem | NavSectionItem> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/brands", label: "Brands", icon: Tag },
  { href: "/admin/inventory", label: "Inventory", icon: Box },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/quotations", label: "Quotations", icon: FileText },
  { href: "/admin/suppliers", label: "Suppliers", icon: Tag },
  { href: "/admin/products/import", label: "Import", icon: Upload },
  {
    href: "/admin/emails",
    label: "Email Center",
    icon: Mail,
    section: "Email Center",
    sub: [
      { href: "/admin/emails", label: "Overview" },
      { href: "/admin/emails/history", label: "History" },
      { href: "/admin/templates", label: "Templates" },
      { href: "/admin/campaigns", label: "Campaigns" },
      { href: "/admin/followups", label: "Follow-ups" },
      { href: "/admin/webhooks", label: "Webhooks" },
    ],
  },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-section">
        <nav className="admin-sidebar-nav">
          {NAV.filter(item => EMAIL_CENTER_ENABLED || !("section" in item)).map((item) => {
            if ("section" in item) {
              return (
                <div key={item.href} className="admin-sidebar-section admin-sidebar-email">
                  <div className="admin-sidebar-heading">{item.label}</div>
                  <nav className="admin-sidebar-nav admin-sidebar-nav--sub">
                    {item.sub.map((sub) => {
                      const active =
                        pathname === sub.href ||
                        pathname.startsWith(sub.href + "/");
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`admin-sidebar-link${active ? " active" : ""}`}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              );
            }

            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sidebar-link${active ? " active" : ""}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {active && <ChevronRight size={14} className="admin-sidebar-link-arrow" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="admin-sidebar-section">
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-heading">Admin</h2>
        </div>
        <nav className="admin-sidebar-nav">
          <Link
            href="/admin/login"
            className={`admin-sidebar-link${pathname === "/admin/login" ? " active" : ""}`}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </Link>
        </nav>
      </div>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-footer-notice">
          <AlertTriangle size={14} />
          <span>AB Tech Admin · Private</span>
        </div>
      </div>
    </aside>
  );
}
