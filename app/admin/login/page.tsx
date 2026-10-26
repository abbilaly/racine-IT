"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="admin-login">
      <form
        className="admin-login-card"
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
        <h1>Racine IT admin</h1>
        <p className="muted-note">
          Sign in with an administrator account. Access is checked against the database on every
          request.
        </p>

        <label className="field">
          Email address
          <input type="email" name="email" autoComplete="username" required placeholder="you@example.com" />
        </label>
        <label className="field">
          Password
          <input type="password" name="password" autoComplete="current-password" required minLength={8} />
        </label>

        {error && <p className="checkout-error" role="alert">{error}</p>}

        <button type="submit" className="btn-dark" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
