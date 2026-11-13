"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerSession } from "../CustomerSessionProvider";

export default function SignInForm() {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("A password is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not sign you in. Please try again.");
        return;
      }
      await refresh();
      router.push("/account");
    } catch {
      setError("We could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="account-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="signin-email" className="field-label">Email address</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="field-input"
          placeholder="you@example.com"
        />
      </div>

      <div className="field">
        <div className="field-header">
          <label htmlFor="signin-password" className="field-label">Password</label>
          <Link href="/account/forgot-password" className="link-underline">Forgot password?</Link>
        </div>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="field-input"
          placeholder="Enter your password"
        />
      </div>

      <div className="field">
        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
          />
          <span>Keep me signed in</span>
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
