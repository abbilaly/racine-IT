export type DashboardRangeKey = "today" | "7d" | "30d" | "12m";

export type DashboardWindow = {
  key: DashboardRangeKey;
  /** Inclusive window start, ISO. */
  fromISO: string;
  /** Inclusive window end, ISO. */
  toISO: string;
  granularity: "day" | "month";
  label: string;
  /** Human-readable window, always stated in UTC like the stored timestamps. */
  subtitle: string;
  previous: {
    fromISO: string;
    toISO: string;
    label: string;
  };
};

const RANGE_LABELS: Record<DashboardRangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "12m": "Last 12 months"
};

export function parseDashboardRange(value?: string): DashboardRangeKey {
  return value === "today" || value === "7d" || value === "12m" || value === "30d"
    ? value
    : "30d";
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

/**
 * Resolves a dashboard preset into the current window plus the equal-length
 * window immediately before it. All boundaries are UTC, matching `created_at`.
 */
export function dashboardWindow(key: DashboardRangeKey, now = new Date()): DashboardWindow {
  const today = utcMidnight(now);
  let from: Date;

  switch (key) {
    case "today":
      from = today;
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "12m":
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
      break;
  }

  const toISO = now.toISOString();
  const duration = now.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);

  return {
    key,
    fromISO: from.toISOString(),
    toISO,
    granularity: key === "12m" ? "month" : "day",
    label: RANGE_LABELS[key],
    subtitle: `${formatDay(from)} – ${formatDay(today)} · UTC`,
    previous: {
      fromISO: previousFrom.toISOString(),
      toISO: previousTo.toISOString(),
      label: `${formatDay(previousFrom)} – ${formatDay(previousTo)}`
    }
  };
}
