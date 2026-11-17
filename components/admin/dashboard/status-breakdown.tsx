import { DASHBOARD_STATUS_LABELS, type OrdersByStatusRow } from "@/lib/server/admin-data";

const STATUS_COLOR: Record<string, string> = {
  received: "bg-sky-500",
  processing: "bg-amber-500",
  shipped: "bg-violet-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-500"
};

export function StatusBreakdown({ rows }: { rows: OrdersByStatusRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return <p className="m-0 py-6 text-center text-[13px] text-muted-foreground">No orders in this period.</p>;
  }

  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img"
        aria-label={rows.map((row) => `${DASHBOARD_STATUS_LABELS[row.status] ?? row.status}: ${row.count}`).join(", ")}>
        {rows.filter((row) => row.count > 0).map((row) => (
          <span
            key={row.status}
            className={STATUS_COLOR[row.status] ?? "bg-muted-foreground"}
            style={{ width: `${(row.count / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${STATUS_COLOR[row.status] ?? "bg-muted-foreground"}`}
            />
            <span className="text-muted-foreground">{DASHBOARD_STATUS_LABELS[row.status] ?? row.status}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">{row.count}</span>
            <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((row.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
