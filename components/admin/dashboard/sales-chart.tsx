"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardSeriesPoint } from "@/lib/server/admin-data";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function compactMoney(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

function ChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardSeriesPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{money.format(point.revenue_cents / 100)}</p>
      <p className="text-[11px] text-muted-foreground">
        {point.orders} order{point.orders === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Recharts boundary. Kept as the only client (and only Recharts) import of the
 * dashboard, so the library never reaches other admin routes or the storefront.
 */
export function SalesChart({
  points,
  granularity
}: {
  points: DashboardSeriesPoint[];
  granularity: "day" | "month";
}) {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const interval = granularity === "month" || points.length <= 12
    ? 0
    : Math.max(1, Math.floor(points.length / 6) - 1);

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            interval={interval}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickMargin={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={54}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(value: number) => compactMoney(value)}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="revenue_cents"
            name="Confirmed revenue"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#dashboardRevenueFill)"
            isAnimationActive={animate}
            animationDuration={450}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
