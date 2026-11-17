"use client";

import { useCallback, useEffect, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/admin/ui/dropdown-menu";

/**
 * Column visibility is a presentation-only preference: the server still renders
 * every cell, and this hides matching `[data-col]` cells after hydration. No
 * data is refetched and the preference is stored per table.
 */
export function ColumnToggle({
  tableId,
  columns
}: {
  tableId: string;
  columns: Array<{ id: string; label: string; defaultHidden?: boolean }>;
}) {
  const storageKey = `ab-admin-columns:${tableId}`;
  const [hidden, setHidden] = useState<string[]>(
    columns.filter(column => column.defaultHidden).map(column => column.id)
  );

  const apply = useCallback(
    (next: string[]) => {
      const cells = document.querySelectorAll<HTMLElement>(
        `[data-table="${tableId}"] [data-col]`
      );
      cells.forEach(cell => {
        const col = cell.getAttribute("data-col");
        if (col) cell.hidden = next.includes(col);
      });
    },
    [tableId]
  );

  useEffect(() => {
    let stored: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as string[];
    } catch {
      stored = null;
    }
    const next = stored ?? columns.filter(column => column.defaultHidden).map(column => column.id);
    setHidden(next);
    apply(next);
  }, [apply, columns, storageKey]);

  function toggle(id: string) {
    const next = hidden.includes(id) ? hidden.filter(value => value !== id) : [...hidden, id];
    setHidden(next);
    apply(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Preference is optional.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Columns3 size={14} aria-hidden="true" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map(column => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={!hidden.includes(column.id)}
            onSelect={event => {
              event.preventDefault();
              toggle(column.id);
            }}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
