import type { ReactNode } from "react";

export function TablePageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="m-0 mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
