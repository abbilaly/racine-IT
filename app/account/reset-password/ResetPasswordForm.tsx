"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const type = searchParams.get("type") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTokenField, setShowTokenField] = useState(!!token && type === "recovery");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("A new password is required.");
      return;
    }
    if (password.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { password, confirmPassword };
      if (showTokenField && token) {
        body.token = token;
      }
      const endpoint = showTokenField ? "/api/auth/recover-confirm" : "/api/auth/recover-request";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not update your password. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("We could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <div className="page-heading">
          <h1>Password reset</h1>
          <p>
            Your password was reset successfully. If you were signed in, you&apos;re ready to go. If not,
            sign in now with your new password.
          </p>
        </div>

        <div className="account-form account-success">
          <Link href="/account/signin" className="btn btn-primary">
            Sign in to your account
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="account-form">
      {error && <div className="form-error" role="alert">{error}</div>}

      <form onSubmit={async (e) => {
        e.preventDefault();
        setError(null);

        if (!password) {
          setError("A new password is required.");
          return;
        }
        if (password.length < 8) {
          setError("The new password must be at least 8 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("The passwords do not match.");
          return;
        }

        setLoading(true);
        try {
          const body: Record<string, unknown> = { password, confirmPassword };
          if (showTokenField && token) {
            body.token = token;
          }
          const endpoint = showTokenField ? "/api/auth/recover-confirm" : "/api/auth/recover-request";
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "We could not update your password. Please try again.");
            return;
          }
          setSuccess(true);
        } catch {
          setError("We could not update your password. Please try again.");
        } finally {
          setLoading(false);
        }
      }}>
        {showTokenField ? (
          <p className="form-token-note">
            <RotateCcw size={16} strokeWidth={1.7} />
            Using a reset link from your email? Follow the link — it already contains your token. Only
            paste it here if your email client blocked the link.
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="reset-email" className="field-label">Email address</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="field-input"
                placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-outline"
              disabled={loading}
              onClick={async () => {
                const el = document.getElementById("reset-email"); if (!el || !(el as HTMLInputElement).value.trim()) {
                  setError("Enter your email address.");
                  return;
                }
                window.location.href = "/account/forgot-password";
              }}
            >
              {loading ? "Sending…" : "Send me a reset link"}
            </button>

            <div className="account-divider">
              <span className="account-divider-line" />
              <span className="account-divider-label">or enter a reset token</span>
              <span className="account-divider-line" />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="reset-token" className="field-label">
            Reset token <span className="field-optional">(from your email)</span>
          </label>
          <input
            id="reset-token"
            name="token"
            type="text"
            autoComplete="off"
            value={token}
            onChange={e => {/* token is read from URL; manual entry is optional */}}
            className="field-input mono"
            placeholder="Paste the token from your email"
          />
        </div>

        <div className="field">
          <label htmlFor="reset-password" className="field-label">New password</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="field-input"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="field">
          <label htmlFor="reset-confirm" className="field-label">Confirm new password</label>
          <input
            id="reset-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="field-input"
            placeholder="Repeat your new password"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </div>
  );
}
