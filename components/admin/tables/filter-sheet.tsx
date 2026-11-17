"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/admin/ui/sheet";

/** Filters stay server-rendered; the sheet only hosts them on small screens. */
export function FilterSheet({
  action,
  children,
  hidden
}: {
  action: string;
  children: ReactNode;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] max-w-[90vw] gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-[14px]">Filters</SheetTitle>
          <SheetDescription className="text-[12px]">
            Narrow the list, then apply. Filters are kept in the URL.
          </SheetDescription>
        </SheetHeader>
        <form method="get" action={action} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {hidden &&
            Object.entries(hidden).map(([name, value]) =>
              value ? <input key={name} type="hidden" name={name} value={value} /> : null
            )}
          <div className="flex flex-col gap-3">{children}</div>
          <SheetFooter className="mt-auto flex-row gap-2 p-0">
            <Button type="submit" size="sm" className="flex-1">
              Apply filters
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={action}>Clear</Link>
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
