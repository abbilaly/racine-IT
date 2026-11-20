import Link from "next/link";
import { formatCents, DASHBOARD_STATUS_LABELS, type RecentOrderRow } from "@/lib/server/admin-data";

const STATUS_STYLE: Record<string, string> = {
  received: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  processing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  shipped: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-300"
};

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(iso));
}

export function RecentOrders({ rows, currency }: { rows: RecentOrderRow[]; currency: string }) {
  if (rows.length === 0) {
    return <p className="m-0 py-6 text-center text-[13px] text-muted-foreground">No orders yet.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-4 pb-2 font-medium sm:px-0">Order</th>
            <th className="px-2 pb-2 font-medium">Customer</th>
            <th className="px-2 pb-2 text-right font-medium">Total</th>
            <th className="px-2 pb-2 font-medium">Status</th>
            <th className="px-4 pb-2 text-right font-medium sm:px-0">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} className="border-t border-border/70">
              <td className="px-4 py-2.5 sm:px-0">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {order.ref}
                </Link>
              </td>
              <td className="max-w-[160px] truncate px-2 py-2.5 text-muted-foreground">
                {`${order.first_name} ${order.last_name}`.trim()}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-foreground">
                {formatCents(order.total, currency)}
              </td>
              <td className="px-2 py-2.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[order.status] ?? "bg-muted text-muted-foreground"}`}>
                  {DASHBOARD_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-[12px] tabular-nums text-muted-foreground sm:px-0">
                {shortDate(order.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
