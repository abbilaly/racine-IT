import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Percentage change vs the previous window; null when there is no valid comparison. */
  delta?: number | null;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const comparisonAvailable = delta !== undefined;
  const flat = hasDelta && Math.abs(delta) < 0.05;
  const positive = hasDelta && delta > 0;

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>

      <p className="m-0 mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>

      <div className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px]">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium tabular-nums",
              flat
                ? "bg-muted text-muted-foreground"
                : positive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {flat ? (
              <Minus size={11} aria-hidden="true" />
            ) : positive ? (
              <ArrowUpRight size={11} aria-hidden="true" />
            ) : (
              <ArrowDownRight size={11} aria-hidden="true" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : comparisonAvailable ? (
          <span className="text-muted-foreground">No prior period data</span>
        ) : null}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
