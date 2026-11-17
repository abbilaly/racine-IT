import {
  BarChart3,
  Box,
  FileText,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Upload,
  Users,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Dashboard must not match every /admin/* route. */
  exact?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
  /** Email Center is only rendered when its migration is applied. */
  requiresEmailCenter?: boolean;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }]
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/products/import", label: "Import", icon: Upload },
      { href: "/admin/categories", label: "Categories", icon: Tag },
      { href: "/admin/brands", label: "Brands", icon: Tag },
      { href: "/admin/inventory", label: "Inventory", icon: Box }
    ]
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/quotations", label: "Quotations", icon: FileText }
    ]
  },
  {
    title: "Insights",
    items: [{ href: "/admin/reports", label: "Reports", icon: BarChart3 }]
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/suppliers", label: "Suppliers", icon: Truck },
      { href: "/admin/settings", label: "Settings", icon: Settings }
    ]
  },
  {
    title: "Email Center",
    requiresEmailCenter: true,
    items: [
      { href: "/admin/emails", label: "Overview", icon: Mail, exact: true },
      { href: "/admin/emails/history", label: "History", icon: Mail },
      { href: "/admin/templates", label: "Templates", icon: FileText },
      { href: "/admin/campaigns", label: "Campaigns", icon: Mail },
      { href: "/admin/followups", label: "Follow-ups", icon: Users },
      { href: "/admin/webhooks", label: "Webhooks", icon: Settings }
    ]
  }
];

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const EXTRA_LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
  images: "Images",
  stock: "Stock",
  status: "Status",
  import: "Import",
  history: "History",
  login: "Sign in"
};

const NAV_LABELS: Record<string, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap(section => section.items.map(item => [item.href, item.label]))
);

/** Trailing dynamic segments (ids, emails) are shown as "Details". */
export function breadcrumbsFor(pathname: string): Array<{ label: string; href?: string }> {
  const clean = pathname.replace(/\/+$/, "") || "/admin";
  if (clean === "/admin") return [{ label: "Dashboard" }];

  const parts = clean.split("/").filter(Boolean); // ["admin", ...]
  const crumbs: Array<{ label: string; href?: string }> = [];

  for (let index = 1; index < parts.length; index += 1) {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const known = NAV_LABELS[href] ?? EXTRA_LABELS[parts[index]];
    crumbs.push({ label: known ?? "Details", href });
  }

  const last = crumbs[crumbs.length - 1];
  if (last) last.href = undefined; // current page is not a link
  return crumbs;
}
