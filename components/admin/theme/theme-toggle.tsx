"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { useAdminTheme } from "./theme-provider";

/** Light/dark switch for the admin shell. Placed in the header in Phase 1. */
export function AdminThemeToggle() {
  const { resolved, setTheme } = useAdminTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {resolved === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
