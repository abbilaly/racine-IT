"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useAdminTheme } from "@/components/admin/theme/theme-provider";

/**
 * Toast host for admin feedback (success / error states from Phase 1 onward).
 * The theme comes from the admin-scoped provider, not next-themes, so it can
 * never follow the storefront's document class.
 */
export function AdminToaster(props: ToasterProps) {
  const { resolved } = useAdminTheme();

  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
        }
      }}
      {...props}
    />
  );
}
