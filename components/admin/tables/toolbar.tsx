import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { FilterSheet } from "./filter-sheet";

function SearchField({ defaultValue, placeholder }: { defaultValue?: string; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={15}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

export function FilterField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export function SelectInput(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${props.className ?? ""}`}
    />
  );
}

export function DateInput(props: React.ComponentProps<"input">) {
  return (
    <input
      type="date"
      {...props}
      className={`rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${props.className ?? ""}`}
    />
  );
}

/**
 * One toolbar for both breakpoints: an inline form on desktop and a search box
 * plus filter sheet on smaller screens. `children` are the server-rendered
 * filter controls, reused in both places.
 */
export function TableToolbar({
  action,
  q,
  placeholder,
  children,
  hidden,
  resultLabel
}: {
  action: string;
  q?: string;
  placeholder: string;
  children?: ReactNode;
  hidden?: Record<string, string | undefined>;
  resultLabel?: string;
}) {
  const hiddenFields = hidden
    ? Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null
      )
    : null;

  return (
    <div className="border-b border-border p-3">
      <form method="get" action={action} className="hidden items-end gap-2 lg:flex">
        {hiddenFields}
        <SearchField defaultValue={q} placeholder={placeholder} />
        {children}
        <Button type="submit" size="sm" className="mb-px">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="mb-px">
          <Link href={action}>Clear</Link>
        </Button>
        {resultLabel && (
          <span className="mb-2 ml-1 shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {resultLabel}
          </span>
        )}
      </form>

      <div className="flex items-center gap-2 lg:hidden">
        <form method="get" action={action} className="flex min-w-0 flex-1 items-center gap-2">
          {hiddenFields}
          <SearchField defaultValue={q} placeholder={placeholder} />
        </form>
        {children && (
          <FilterSheet action={action} hidden={hidden}>
            {children}
          </FilterSheet>
        )}
      </div>
    </div>
  );
}
