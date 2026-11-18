"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AdminThemeToggle } from "@/components/admin/theme/theme-toggle";

/**
 * Administrator sign-in form.
 *
 * Used both by `/admin/login` and by `app/admin/layout.tsx`, which renders it as
 * a login wall for any unauthenticated request to an `/admin/*` route. That way
 * admin content is never rendered to an anonymous visitor even if an individual
 * page were to forget its own `requireAdmin()` guard.
 *
 * It is wrapped in `AdminThemeProvider` by the layout, so the tokens below
 * resolve in light and dark mode exactly like the rest of the admin.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <div className="absolute right-4 top-4">
        <AdminThemeToggle />
      </div>

      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-[12px] font-bold text-primary-foreground">
            AB
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-foreground">AB Tech</span>
            <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </span>
          </span>
        </div>

        <form
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
          onSubmit={async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError(null);
            try {
              const response = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: String(data.get("email") ?? ""),
                  password: String(data.get("password") ?? "")
                })
              });
              const body = (await response.json().catch(() => ({}))) as { error?: string };
              if (!response.ok) {
                setError(body.error ?? "Sign-in failed. Please try again.");
                setBusy(false);
                return;
              }
              router.push("/admin");
              router.refresh();
            } catch {
              setError("We could not reach the server. Check your connection and try again.");
              setBusy(false);
            }
          }}
        >
          <h1 className="m-0 text-[20px] font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            Use an administrator account. Access is checked against the database on every request.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-foreground">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                placeholder="you@example.com"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-foreground">
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] font-normal text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-9 w-full rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
