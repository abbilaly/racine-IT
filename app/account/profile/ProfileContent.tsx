"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { User, Mail, Phone, Calendar, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCustomerSession } from "../CustomerSessionProvider";
import SignOutButton from "./SignOutButton";

type Profile = {
  fullName: string;
  email: string;
  phone: string | null;
  emailConfirmed: boolean;
  createdAt: string | null;
};

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile, refresh, loading: sessionLoading } = useCustomerSession();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (sessionLoading || !session) {
    return (
      <div className="account-loading">
        <div className="account-spinner" aria-hidden="true" />
        <p>Loading your account…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="account-empty">
        <h2>We couldn&apos;t load your profile</h2>
        <p>Refresh the page or sign out and back in to try again.</p>
        <button className="btn btn-outline" onClick={() => refresh()}>Refresh</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="account-form account-success">
        <button className="btn btn-primary" onClick={() => { setSuccess(false); setEditing(false); refresh(); }}>
          Return to profile
        </button>
      </div>
    );
  }

  const startEditing = useCallback(() => {
    setFullName(profile.fullName);
    setPhone(profile.phone ?? "");
    setEmail(profile.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setEditing(true);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
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

    const emailChanged = email.trim().toLowerCase() !== profile.email;
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        setError("The new password must be at least 8 characters.");
        return;
      }
      if (!currentPassword) {
        setError("Enter your current password to change it.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("The new password and confirmation do not match.");
        return;
      }
    }

    setSaveLoading(true);
    try {
      const body: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: emailChanged ? email.trim().toLowerCase() : undefined,
        phone: phone.trim() || undefined,
      };
      if (newPassword && currentPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch("/api/auth/me/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not save your profile. Please try again.");
        return;
      }
      await refresh();
      setEditing(false);
      setSuccess(true);
      if (data.needsPasswordRestart) {
        router.push("/account/signin?reset=1");
      }
    } catch {
      setError("We could not save your profile. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="account-form">
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="profile-header">
        <div className="profile-avatar" aria-hidden="true">
          <User size={32} strokeWidth={1.5} />
        </div>
        <div className="profile-meta">
          <div>
            <h2>{profile.fullName || "No name set"}</h2>
            <p className="muted-note">{profile.email}</p>
          </div>
          <div className="profile-badges">
            {profile.emailConfirmed ? (
              <span className="badge badge-verified">
                <ShieldCheck size={12} strokeWidth={2} />
                Email verified
              </span>
            ) : (
              <span className="badge badge-warning">Email not verified</span>
            )}
            {profile.createdAt && (
              <span className="badge badge-meta">
                <Calendar size={12} strokeWidth={1.7} />
                Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <form className="profile-form" onSubmit={handleSave} noValidate>
          <div className="field">
            <label htmlFor="profile-fullname" className="field-label">Full name</label>
            <input
              id="profile-fullname"
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
            <label htmlFor="profile-email" className="field-label">Email address</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field-input"
              placeholder="you@example.com"
            />
            {email.toLowerCase() !== profile.email && (
              <p className="field-hint">Changing your email requires email confirmation.</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="profile-phone" className="field-label">
              Phone <span className="field-optional">(optional)</span>
            </label>
            <input
              id="profile-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="field-input"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="profile-password-section">
            <span className="profile-section-title">Change password</span>
            <p className="muted-note">Leave blank to keep your current password.</p>

            <div className="field">
              <label htmlFor="profile-current" className="field-label">Current password</label>
              <input
                id="profile-current"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="field-input"
                placeholder="Enter current password"
              />
            </div>

            <div className="field">
              <label htmlFor="profile-new" className="field-label">New password</label>
              <input
                id="profile-new"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="field-input"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="field">
              <label htmlFor="profile-confirm" className="field-label">Confirm new password</label>
              <input
                id="profile-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="field-input"
                placeholder="Repeat your new password"
              />
            </div>
          </div>

          <div className="profile-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saveLoading}>
              {saveLoading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="profile-view">
          <div className="profile-row">
            <Mail size={16} strokeWidth={1.7} />
            <div>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>
          </div>
          <div className="profile-row">
            <Phone size={16} strokeWidth={1.7} />
            <div>
              <dt>Phone</dt>
              <dd>{profile.phone ?? <em>Not set</em>}</dd>
            </div>
          </div>
          <div className="profile-row">
            <Calendar size={16} strokeWidth={1.7} />
            <div>
              <dt>Member since</dt>
              <dd>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}</dd>
            </div>
          </div>
          <div className="profile-row">
            <ShieldCheck size={16} strokeWidth={1.7} />
            <div>
              <dt>Email verification</dt>
              <dd>{profile.emailConfirmed ? "Verified" : "Not verified"}</dd>
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn btn-primary" onClick={startEditing}>
              Edit profile
            </button>
            <Link href="/account/orders" className="btn btn-outline">
              View my orders
            </Link>
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
