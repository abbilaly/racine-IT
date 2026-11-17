import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tableHref, type TableParams } from "./sort-header";

export function TablePagination({
  base,
  params,
  page,
  totalPages,
  totalItems,
  pageSize,
  label = "items"
}: {
  base: string;
  params: TableParams;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  label?: string;
}) {
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  for (let index = start; index <= Math.min(totalPages, start + 2); index += 1) pages.push(index);

  const href = (target: number) => tableHref(base, params, { page: String(target) });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5">
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {totalItems === 0 ? `No ${label}` : `${first}–${last} of ${totalItems.toLocaleString()} ${label}`}
      </p>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              aria-label="Previous page"
              className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-md border border-border/60 text-muted-foreground/40">
              <ChevronLeft size={14} />
            </span>
          )}

          {pages.map(number => (
            <Link
              key={number}
              href={href(number)}
              aria-current={number === page ? "page" : undefined}
              className={cn(
                "grid size-7 place-items-center rounded-md text-[12px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                number === page
                  ? "border border-border bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {number}
            </Link>
          ))}

          {page < totalPages ? (
            <Link
              href={href(page + 1)}
              aria-label="Next page"
              className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-md border border-border/60 text-muted-foreground/40">
              <ChevronRight size={14} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
