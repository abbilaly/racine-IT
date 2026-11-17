import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TableCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Table({
  children,
  tableId,
  minWidth = "min-w-[680px]",
  label
}: {
  children: ReactNode;
  tableId?: string;
  minWidth?: string;
  label: string;
}) {
  return (
    <table
      aria-label={label}
      data-table={tableId}
      className={cn("w-full border-collapse text-left text-[13px]", minWidth)}
    >
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
      <tr className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Th({
  children,
  className,
  col
}: {
  children: ReactNode;
  className?: string;
  col?: string;
}) {
  return (
    <th
      scope="col"
      data-col={col}
      className={cn("whitespace-nowrap px-3 py-2.5 font-medium first:pl-4 last:pr-4", className)}
    >
      {children}
    </th>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={cn(
        "border-t border-border/70 transition-colors hover:bg-accent/60 focus-within:bg-accent/40",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  col,
  hideBelow
}: {
  children: ReactNode;
  className?: string;
  col?: string;
  /** Responsive column: hidden below the given breakpoint. */
  hideBelow?: "sm" | "md" | "lg";
}) {
  return (
    <td
      data-col={col}
      className={cn(
        "px-3 py-2.5 align-middle first:pl-4 last:pr-4",
        hideBelow === "sm" && "hidden sm:table-cell",
        hideBelow === "md" && "hidden md:table-cell",
        hideBelow === "lg" && "hidden lg:table-cell",
        className
      )}
    >
      {children}
    </td>
  );
}

export function TdMuted({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-muted-foreground", className)}>{children}</span>;
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}
