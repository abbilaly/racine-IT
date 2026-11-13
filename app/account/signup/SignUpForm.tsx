"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!/^[a-zA-Z0-9 .'\\-]+$/.test(fullName.trim()) || fullName.trim().length > 120) {
      setError("Full name must be 1–120 letters, digits, spaces, dots, apostrophes or hyphens.");
      return;
    }
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not create your account. Please try again.");
        return;
      }
      setSuccessEmail(email.trim().toLowerCase());
      setSuccess(true);
    } catch {
      setError("We could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = useCallback(() => {
    // Google sign-up is intentionally non-functional.
    setError("Google sign-up will be available soon.");
  }, []);

  if (success) {
    return (
      <>
        <div className="page-heading">
          <h1>Check your email</h1>
          <p>
            If an AB Tech account could be created for <b>{successEmail}</b>, we sent a confirmation email to
            that address. Open the email and follow the link to verify your email address, then sign in
            on this page.
          </p>
        </div>

        <div className="account-form account-success">
          <p>
            Didn&apos;t receive the email? Check your spam folder, then{" "}
            <Link href="/account/signup" className="link-underline">try again</Link>.
          </p>
          <Link href="/account/signin" className="btn btn-primary">
            Sign in to your account
          </Link>
        </div>
      </>
    );
  }

  return (
    <form className="account-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="signup-fullname" className="field-label">Full name</label>
        <input
          id="signup-fullname"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="field-input"
          placeholder="Jane Doe"
        />
      </div>

      <div className="field">
        <label htmlFor="signup-email" className="field-label">Email address</label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-phone" className="field-label">
          Phone <span className="field-optional">(optional)</span>
        </label>
        <input
          id="signup-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="field-input"
          placeholder="+1 (555) 000-0000"
        />
      </div>

      <div className="field">
        <label htmlFor="signup-password" className="field-label">Password</label>
        <input
          id="signup-password"
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
        <label htmlFor="signup-confirm" className="field-label">Confirm password</label>
        <input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="field-input"
          placeholder="Repeat your password"
        />
      </div>

      <div className="account-divider">
        <span className="account-divider-line" />
        <span className="account-divider-label">or continue with</span>
        <span className="account-divider-line" />
      </div>

      <div className="account-social-notice">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.82 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <div>
          <p style={{margin:0,fontWeight:600,fontSize:12,color:'#111'}}>Google sign-up</p>
          <p style={{margin:2,color:'#888',fontSize:11,lineHeight:1.5}}>Not available yet — use email and password to create your account.</p>
        </div>
      </div>

      <p className="terms-note">
        By creating an account, you agree to receive order updates and account-related emails from AB
        Tech. You can opt out at any time.
      </p>
    </form>
  );
}
