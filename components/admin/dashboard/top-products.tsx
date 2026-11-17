import { formatCents, type BestSellerRow } from "@/lib/server/admin-data";

export function TopProducts({ rows }: { rows: BestSellerRow[] }) {
  if (rows.length === 0) {
    return <p className="m-0 py-6 text-center text-[13px] text-muted-foreground">No product sales in this period.</p>;
  }

  const max = Math.max(...rows.map((row) => row.revenue_cents), 1);

  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((row, index) => (
        <li key={row.slug}>
          <div className="mb-1 flex items-baseline gap-2 text-[13px]">
            <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={row.title}>
              {row.title}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {row.units_sold} sold
            </span>
            <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-foreground">
              {formatCents(row.revenue_cents)}
            </span>
          </div>
          <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--chart-2)]"
              style={{ width: `${Math.max(4, (row.revenue_cents / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
