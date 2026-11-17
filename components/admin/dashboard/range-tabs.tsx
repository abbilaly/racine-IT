import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardRangeKey } from "@/lib/server/dashboard-range";

const RANGES: Array<{ key: DashboardRangeKey; label: string; long: string }> = [
  { key: "today", label: "Today", long: "Today" },
  { key: "7d", label: "7D", long: "Last 7 days" },
  { key: "30d", label: "30D", long: "Last 30 days" },
  { key: "12m", label: "12M", long: "Last 12 months" }
];

/** Plain links, so the range lives in the URL and the page stays server-rendered. */
export function RangeTabs({ active }: { active: DashboardRangeKey }) {
  return (
    <nav aria-label="Dashboard date range">
      <ul className="m-0 flex list-none gap-1 rounded-lg border border-border bg-muted p-1">
        {RANGES.map((range) => {
          const current = range.key === active;
          return (
            <li key={range.key}>
              <Link
                href={`/admin?range=${range.key}`}
                aria-current={current ? "page" : undefined}
                title={range.long}
                className={cn(
                  "block rounded-md px-2.5 py-1.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="sm:hidden">{range.label}</span>
                <span className="hidden sm:inline">{range.long}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
