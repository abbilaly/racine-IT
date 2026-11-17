"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/admin/ui/dropdown-menu";

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (letters || "AB").toUpperCase();
}

export function UserMenu({ email, role }: { email: string; role: string }) {
  return (
    <>
      {/* Native POST keeps logout working without JavaScript. */}
      <form id="admin-logout-form" action="/api/admin/logout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Account menu for ${email}`}
            className="rounded-full"
          >
            <span className="grid size-8 place-items-center rounded-full bg-[#100024] text-[11px] font-semibold text-white">
              {initials(email)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-[13px] font-medium text-foreground">{email}</span>
            <span className="block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" form="admin-logout-form" className="w-full">
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
