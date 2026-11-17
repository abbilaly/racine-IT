import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableParams = Record<string, string | undefined>;

/** Preserves the current filters and resets pagination when sorting changes. */
export function tableHref(base: string, params: TableParams, overrides: TableParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value && value !== "all") search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function SortHeader({
  label,
  column,
  base,
  params,
  className
}: {
  label: string;
  column: string;
  base: string;
  params: TableParams;
  className?: string;
}) {
  const active = params.sort === column;
  const nextDir = active && params.dir !== "asc" ? "asc" : "desc";
  const href = tableHref(base, params, { sort: column, dir: nextDir, page: undefined });
  const Icon = active ? (params.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th
      scope="col"
      className={cn("whitespace-nowrap px-3 py-2.5 font-medium first:pl-4 last:pr-4", className)}
      aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded text-inherit outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <Icon size={11} aria-hidden="true" className={active ? "text-foreground" : "opacity-50"} />
      </Link>
    </th>
  );
}
