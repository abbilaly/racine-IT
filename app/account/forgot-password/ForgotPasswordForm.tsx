"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");  

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/recover-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not send the recovery email. Please try again.");
        return;
      }
      setSentTo(email.trim().toLowerCase());
      setSent(true);
    } catch {
      setError("We could not send the recovery email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="account-form">
        <p>
          If an AB Tech account exists for <b>{sentTo}</b>, we sent a password-reset link to that
          address. Open the email and follow the link to set a new password.
        </p>
        <p>
          Didn&apos;t receive the email? Check your spam folder, then{" "}
          <button type="button" className="link-underline" onClick={() => {
            setSent(false);
            setSentTo("");
            setEmail(sentTo);
            setError(null);
          }}>
            request another one
          </button>
          .
        </p>
        <Link href="/account/signin" className="btn btn-primary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="account-form" onSubmit={handleFormSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="forgot-email" className="field-label">Email address</label>
        <input
          id="forgot-email"
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

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
