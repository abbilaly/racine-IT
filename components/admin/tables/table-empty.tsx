import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function TableEmpty({
  title,
  description,
  icon,
  action
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox size={20} aria-hidden="true" />}
      </span>
      <p className="m-0 text-[13px] font-medium text-foreground">{title}</p>
      <p className="m-0 max-w-sm text-[12px] text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
