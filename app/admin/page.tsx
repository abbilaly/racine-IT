import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Box,
  DollarSign,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet
} from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import {
  dashboardTotals,
  formatCents,
  getRecentOrders,
  lowStockProducts,
  ordersByStatusInRange,
  salesSeriesInRange,
  topProductsInRange,
  type DashboardTotals
} from "@/lib/server/admin-data";
import { dashboardWindow, parseDashboardRange } from "@/lib/server/dashboard-range";
import { Card } from "@/components/admin/ui/card";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { LowStockList } from "@/components/admin/dashboard/low-stock-list";
import { RangeTabs } from "@/components/admin/dashboard/range-tabs";
import { RecentOrders } from "@/components/admin/dashboard/recent-orders";
import { SalesChart } from "@/components/admin/dashboard/sales-chart";
import { StatusBreakdown } from "@/components/admin/dashboard/status-breakdown";
import { TopProducts } from "@/components/admin/dashboard/top-products";
import { getStoreCurrency } from "@/lib/server/store-currency";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Admin"
};

function percentChange(current: number, previous: number, valid: boolean): number | null {
  if (!valid || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function quickAction(
  href: string,
  label: string,
  description: string,
  Icon: typeof Package
) {
  return (
    <Link
      key={href}
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 outline-none transition-colors hover:border-foreground/20 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
      </span>
      <ArrowRight size={14} className="ml-auto shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </Link>
  );
}

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);

  const params = await searchParams;
  const key = parseDashboardRange(params.range);
  const window = dashboardWindow(key);

  const [currency, totals, previous, series, statuses, topProducts, recentOrders, lowStock] =
    await Promise.all([
      getStoreCurrency(),
      dashboardTotals(db, window.fromISO, window.toISO),
      dashboardTotals(db, window.previous.fromISO, window.previous.toISO),
      salesSeriesInRange(db, window.fromISO, window.toISO, window.granularity),
      ordersByStatusInRange(db, window.fromISO, window.toISO),
      topProductsInRange(db, window.fromISO, window.toISO, 5),
      getRecentOrders(db, 6),
      lowStockProducts(db)
    ]);

  // A comparison is only shown when the earlier window actually contains orders.
  const comparable = previous.orders_confirmed > 0;
  const comparison = (current: number, before: number) =>
    percentChange(current, before, comparable);

  const emptyPeriod = totals.orders_all === 0;

  return (
    <div className="admin-page">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            {window.label} · {window.subtitle}
          </p>
        </div>
        <RangeTabs active={window.key} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Gross order value"
          value={formatCents(totals.gross_cents, currency)}
          hint="All orders placed"
          icon={Receipt}
          delta={comparable ? comparison(totals.gross_cents, previous.gross_cents) : undefined}
        />
        <KpiCard
          label="Confirmed revenue"
          value={formatCents(totals.confirmed_cents, currency)}
          hint="Excludes cancelled"
          icon={DollarSign}
          delta={comparable ? comparison(totals.confirmed_cents, previous.confirmed_cents) : undefined}
        />
        <KpiCard
          label="Realized revenue"
          value={formatCents(totals.realized_cents, currency)}
          hint="Delivered orders only"
          icon={Wallet}
          delta={comparable ? comparison(totals.realized_cents, previous.realized_cents) : undefined}
        />
        <KpiCard
          label="Total orders"
          value={totals.orders_all.toLocaleString("en-US")}
          hint={`${totals.orders_confirmed} confirmed`}
          icon={ShoppingCart}
          delta={comparable ? comparison(totals.orders_all, previous.orders_all) : undefined}
        />
        <KpiCard
          label="Average order value"
          value={formatCents(totals.aov_cents, currency)}
          hint="Confirmed orders"
          icon={TrendingUp}
          delta={comparable ? comparison(totals.aov_cents, previous.aov_cents) : undefined}
        />
        <KpiCard
          label="Customers"
          value={totals.customers.toLocaleString("en-US")}
          hint={`${totals.new_customers} new`}
          icon={Users}
          delta={comparable ? comparison(totals.customers, previous.customers) : undefined}
        />
      </div>

      {!comparable && (
        <p className="m-0 mt-2 text-[11px] text-muted-foreground">
          No orders in the previous window ({window.previous.label}), so period comparisons are hidden.
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 p-4 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Sales trend</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                Confirmed revenue, cancelled orders excluded
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-[15px] font-semibold tabular-nums text-foreground">
                {formatCents(totals.confirmed_cents, currency)}
              </p>
              <p className="m-0 text-[11px] text-muted-foreground">{window.label}</p>
            </div>
          </div>
          {totals.orders_confirmed === 0 ? (
            <div className="grid h-[260px] place-items-center rounded-lg border border-dashed border-border">
              <p className="text-[13px] text-muted-foreground">
                No confirmed orders in this period.
              </p>
            </div>
          ) : (
            <SalesChart points={series} granularity={window.granularity} currency={currency} />
          )}
        </Card>

        <Card className="gap-0 p-4">
          <div className="mb-4">
            <h2 className="m-0 text-[14px] font-semibold text-foreground">Orders by status</h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">{window.label}</p>
          </div>
          <StatusBreakdown rows={statuses} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Top products</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">By revenue, {window.label.toLowerCase()}</p>
            </div>
            <BarChart3 size={15} className="mt-0.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <TopProducts rows={topProducts} currency={currency} />
        </Card>

        <Card className="gap-0 p-4 xl:col-span-2">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Recent orders</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Newest first, all time</p>
            </div>
            <Link
              href="/admin/orders"
              className="rounded text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all
            </Link>
          </div>
          <RecentOrders rows={recentOrders} currency={currency} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 p-4">
          <div className="mb-3">
            <h2 className="m-0 text-[14px] font-semibold text-foreground">Low stock</h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Inventory at 5 units or fewer</p>
          </div>
          <LowStockList rows={lowStock} />
        </Card>

        <Card className="gap-0 p-4 xl:col-span-2">
          <div className="mb-3">
            <h2 className="m-0 text-[14px] font-semibold text-foreground">Quick actions</h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Jump into the screens you use most</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {quickAction("/admin/orders", "Review orders", "Update status and details", ShoppingCart)}
            {quickAction("/admin/products/new", "Add a product", "Publish to the storefront", Package)}
            {quickAction("/admin/inventory", "Adjust inventory", "Stock levels and history", Box)}
            {quickAction("/admin/customers", "Customers", "Orders, spend and follow-ups", Users)}
          </div>
        </Card>
      </div>

      <p className="m-0 mt-4 text-[11px] text-muted-foreground">
        {emptyPeriod
          ? "No orders were placed in this window."
          : `Confirmed revenue counts ${totals.orders_confirmed} of ${totals.orders_all} orders; realized revenue counts delivered orders only.`}
      </p>
    </div>
  );
}
