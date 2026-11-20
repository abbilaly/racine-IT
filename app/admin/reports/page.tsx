import Link from "next/link";
import { BarChart3, DollarSign, Package, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import {
  bestSellingProducts,
  formatCents,
  last30Days,
  lowStockProducts,
  ordersByStatusInRange,
  salesReport,
  type DashboardSeriesPoint
} from "@/lib/server/admin-data";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { SalesChart } from "@/components/admin/dashboard/sales-chart";
import { StatusBreakdown } from "@/components/admin/dashboard/status-breakdown";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TableCard, TableScroll, Table, THead, TBody, Th, Tr, Td } from "@/components/admin/tables/table";
import { getStoreCurrency } from "@/lib/server/store-currency";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports · Admin"
};

function shortDay(period: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${period}T00:00:00.000Z`));
}

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const currency = await getStoreCurrency();
  const params = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const to = isCalendarDate(params.to) ? params.to : today;
  const from = isCalendarDate(params.from) ? params.from : last30Days().slice(0, 10);

  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  const [sales, byStatus, best, low] = await Promise.all([
    salesReport(db, fromISO, toISO),
    ordersByStatusInRange(db, fromISO, toISO),
    bestSellingProducts(db, 20),
    lowStockProducts(db, 5)
  ]);

  const totalRevenue = sales.reduce((sum, point) => sum + point.revenue_cents, 0);
  const totalOrders = sales.reduce((sum, point) => sum + point.orders, 0);
  const averageOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const series: DashboardSeriesPoint[] = sales.map(point => ({
    key: point.period,
    label: shortDay(point.period),
    revenue_cents: point.revenue_cents,
    orders: point.orders
  }));

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Reports"
        subtitle={`Sales, orders and inventory · ${displayDate(from)} – ${displayDate(to)}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/orders">Open orders</Link>
          </Button>
        }
      />

      <Card className="mb-4 gap-0 p-3">
        <form method="get" action="/admin/reports" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="from" className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              From
            </Label>
            <Input id="from" type="date" name="from" defaultValue={from} className="h-8 w-[150px] text-[12px]" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to" className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              To
            </Label>
            <Input id="to" type="date" name="to" defaultValue={to} className="h-8 w-[150px] text-[12px]" />
          </div>
          <Button type="submit" size="sm" className="mb-px">
            Apply range
          </Button>
          <Link
            href="/admin/reports"
            className="mb-1 ml-1 rounded text-[12px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reset to last 30 days
          </Link>
          <span className="mb-1.5 ml-auto text-[11px] text-muted-foreground">
            {sales.length} day{sales.length === 1 ? "" : "s"} with sales
          </span>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue in range"
          value={formatCents(totalRevenue, currency)}
          hint="Cancelled orders excluded"
          icon={DollarSign}
        />
        <KpiCard
          label="Orders in range"
          value={totalOrders.toLocaleString("en-US")}
          hint={`${displayDate(from)} – ${displayDate(to)}`}
          icon={Receipt}
        />
        <KpiCard
          label="Average order value"
          value={formatCents(averageOrder, currency)}
          hint="Confirmed orders"
          icon={TrendingUp}
        />
        <KpiCard
          label="Low-stock products"
          value={low.length.toLocaleString("en-US")}
          hint="At or below 5 units"
          icon={Package}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 p-4 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Sales over time</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                Daily confirmed revenue, cancelled orders excluded
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-[15px] font-semibold tabular-nums text-foreground">
                {formatCents(totalRevenue, currency)}
              </p>
              <p className="m-0 text-[11px] text-muted-foreground">{totalOrders} orders</p>
            </div>
          </div>
          {sales.length === 0 ? (
            <div className="grid h-[260px] place-items-center rounded-lg border border-dashed border-border">
              <div className="text-center">
                <TrendingUp size={20} className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
                <p className="m-0 text-[13px] font-medium text-foreground">No sales in this range</p>
                <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">Choose a wider date range.</p>
              </div>
            </div>
          ) : (
            <SalesChart points={series} granularity="day" currency={currency} />
          )}
        </Card>

        <Card className="gap-0 p-4">
          <div className="mb-4">
            <h2 className="m-0 text-[14px] font-semibold text-foreground">Orders by status</h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Within the selected range</p>
          </div>
          <StatusBreakdown rows={byStatus} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <TableCard className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Best-selling products</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">All-time units and revenue</p>
            </div>
            <BarChart3 size={15} className="mt-0.5 text-muted-foreground" aria-hidden="true" />
          </div>
          {best.length === 0 ? (
            <p className="m-0 px-4 py-10 text-center text-[13px] text-muted-foreground">
              No product sales yet.
            </p>
          ) : (
            <TableScroll>
              <Table label="Best-selling products" tableId="report-best-sellers" minWidth="min-w-[520px]">
                <THead>
                  <Th className="w-8">#</Th>
                  <Th>Product</Th>
                  <Th className="text-right">Units</Th>
                  <Th className="text-right">Revenue</Th>
                </THead>
                <TBody>
                  {best.slice(0, 10).map((row, index) => (
                    <Tr key={row.slug}>
                      <Td className="tabular-nums text-muted-foreground">{index + 1}</Td>
                      <Td className="max-w-[320px] truncate font-medium text-foreground" >{row.title}</Td>
                      <Td className="text-right tabular-nums">{row.units_sold}</Td>
                      <Td className="text-right tabular-nums font-medium">{formatCents(row.revenue_cents, currency)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </TableCard>

        <TableCard>
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Low stock</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">5 units or fewer</p>
            </div>
            <Link
              href="/admin/inventory"
              className="rounded text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Inventory
            </Link>
          </div>
          {low.length === 0 ? (
            <p className="m-0 flex items-center gap-2 px-4 py-10 text-[13px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Everything is stocked above the threshold.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0 p-0">
              {low.slice(0, 6).map(row => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 text-[13px] first:border-t-0"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground" title={row.title}>
                    {row.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                      row.stock === 0
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {row.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TableCard>
      </div>

      <p className="m-0 mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShoppingCart size={12} aria-hidden="true" />
        Revenue counts every non-cancelled order in the range; status totals include cancelled orders.
      </p>
    </div>
  );
}
