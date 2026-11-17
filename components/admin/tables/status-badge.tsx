import { cn } from "@/lib/utils";

type Tone = "sky" | "amber" | "violet" | "emerald" | "rose" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground"
};

const DOT_CLASS: Record<Tone, string> = {
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  neutral: "bg-muted-foreground/60"
};

export const STATUS_TONES: Record<string, Tone> = {
  received: "sky",
  processing: "amber",
  shipped: "violet",
  delivered: "emerald",
  cancelled: "rose",
  active: "emerald",
  hidden: "neutral",
  "in stock": "emerald",
  "low stock": "amber",
  "out of stock": "rose",
  draft: "neutral",
  sent: "sky",
  accepted: "emerald",
  rejected: "rose",
  expired: "amber"
};

export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  active: "Active",
  hidden: "Hidden",
  "in stock": "In stock",
  "low stock": "Low stock",
  "out of stock": "Out of stock",
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired"
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const tone = STATUS_TONES[key] ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone]
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} />
      {STATUS_LABELS[key] ?? status}
    </span>
  );
}
