import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { LowStockRow } from "@/lib/server/admin-data";

export function LowStockList({ rows }: { rows: LowStockRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="m-0 flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Every product is above the low-stock threshold.
      </p>
    );
  }

  return (
    <>
      <p className="m-0 mb-3 flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
        <AlertTriangle size={13} aria-hidden="true" />
        {rows.length} product{rows.length === 1 ? "" : "s"} at or below 5 units
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.slice(0, 5).map((row) => (
          <li key={row.id} className="flex items-center gap-2 text-[13px]">
            <Link
              href={`/admin/inventory`}
              className="min-w-0 flex-1 truncate text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              title={row.title}
            >
              {row.title}
            </Link>
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
    </>
  );
}
