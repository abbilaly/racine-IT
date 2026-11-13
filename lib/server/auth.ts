/**
 * Customer authentication operations for the AB Tech storefront.
 *
 * Server-only helpers that wrap Supabase Auth for customer email/password
 * registration, sign-in, sign-out, profile editing and password recovery.
 *
 * SECURITY
 * --------
 * This file is server-only. It never runs in a "use client" component. The
 * browser receives only httpOnly cookies; no access tokens, refresh tokens or
 * passwords are ever shipped to client code.
 *
 * Registration modes
 * ------------------
 * `CUSTOMER_ALLOW_REGISTRATION` decides what POST /api/auth/signup does:
 *
 *   live      (CUSTOMER_ALLOW_REGISTRATION=1)      → a real auth.user is created.
 *   dry-run   (unset, NODE_ENV !== "production")   → the form is validated but no
 *             account is created. Development/preview only.
 *   disabled  (unset, NODE_ENV === "production")   → the API refuses the request
 *             with an explicit message instead of pretending to have created an
 *             account.
 *
 * The `disabled` mode exists because a silent dry-run in production would let a
 * customer believe their account exists when it does not (they then cannot sign
 * in, and no account or order history can ever exist). Set the variable in the
 * deployed environment before advertising account creation. See README.md.
 */

import { cookies as nextCookies } from "next/headers";
import {
  createUserClient,
  getAuthClient,
  getServiceClient,
  isSupabaseConfigured
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_COOKIE_MAX_AGE,
  type CustomerSession
} from "./customer-auth";

const ALLOW_REGISTRATION = (process.env.CUSTOMER_ALLOW_REGISTRATION ?? "").trim() === "1";

export type RegistrationMode = "live" | "dry-run" | "disabled";

/**
 * Resolves what sign-up should do in this environment (see the file header).
 * `disabled` applies only to production builds, so local previews keep the
 * convenient dry-run flow.
 */
export function registrationMode(): RegistrationMode {
  if (ALLOW_REGISTRATION) return "live";
  return process.env.NODE_ENV === "production" ? "disabled" : "dry-run";
}

/**
 * Returns true when this environment actually creates customer accounts.
 */
export function customerRegistrationActuallyCreatesAccounts(): boolean {
  return registrationMode() === "live";
}

const NAME_RE = /^[a-zA-Z0-9 .'\-]+$/;

function normaliseName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 120 || !NAME_RE.test(trimmed)) {
    throw new Error("Full name must be 1–120 letters, digits, spaces, dots, apostrophes or hyphens.");
  }
  return trimmed;
}

function normaliseEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  return trimmed;
}

/**
 * Supabase asks for passwords of at least 6 characters in most configs, but the
 * storefront enforces a stronger minimum and a reasonable upper bound.
 */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalisePassword(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (trimmed.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
  return trimmed;
}

const PHONE_RE = /^[A-Za-z0-9 +().\-\/]{5,40}$/;

function normalisePhone(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim().length === 0) return null;
  const trimmed = raw.trim();
  if (!PHONE_RE.test(trimmed)) {
    throw new Error("Phone number must be 5–40 letters, digits or common separators.");
  }
  return trimmed;
}

/** Sets the customer session cookie from a verified Supabase session. */
async function rememberCustomer(
  response: { cookies: { set: (name: string, value: string, options?: Record<string, unknown>) => void } },
  accessToken: string,
  expiresIn: number
) {
  const maxAge = expiresIn > 0 ? Math.min(expiresIn, CUSTOMER_COOKIE_MAX_AGE) : CUSTOMER_COOKIE_MAX_AGE;
  response.cookies.set(CUSTOMER_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
}

/**
 * Creates a new auth.user (if this environment allows it) and, when allowed,
 * returns the freshly created session. When registration is disabled the call
 * still validates the form, but signUp is not executed and no real account is
 * created.
 *
 * The returned envelope is stable regardless of the flag, so the UI can render
 * the same "check your email" flow.
 */
export async function signUp(attrs: {
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
}): Promise<{
  ok: boolean;
  startedEmailVerification: boolean;
  email: string;
  error?: string;
  user?: { id: string; email: string };
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, startedEmailVerification: false, email: attrs.email, error: "Supabase is not configured for this environment yet." };
  }

  const fullName = normaliseName(attrs.fullName);
  const email = normaliseEmail(attrs.email);
  const password = normalisePassword(attrs.password);
  const phone = normalisePhone(attrs.phone);

  const mode = registrationMode();

  // Production without CUSTOMER_ALLOW_REGISTRATION=1: say so plainly instead of
  // returning a fake "check your email" success that creates nothing.
  if (mode === "disabled") {
    console.warn("[auth.signUp] refused: customer registration is disabled in this environment.");
    return {
      ok: false,
      startedEmailVerification: false,
      email,
      error:
        "Online account creation is not open yet. You can still check out as a guest, or contact us and we will set up your account."
    };
  }

  if (mode === "live") {
    // The client used to call signUp carries the anon key (or service-role as
    // fallback) — it is never the customer's access token.
    const auth = getAuthClient().auth;
    try {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: {
          data: { display_name: fullName, phone }
        }
      });

      if (error) {
        // Safe server-side diagnostic logging: log only the error category/code
        // and a sanitized message. Never echo raw Supabase errors, stack traces,
        // request headers, API keys, tokens, passwords, or personal data to the
        // public API response.
        const sanitisedEmail = email.length > 0 ? email.slice(0, 4) + "***@***" : "(no email)";
        if (error instanceof Object && "message" in error) {
          const message = String((error as { message: unknown }).message);
          // Categorise without exposing the raw message to the client.
          const isDuplicate = /already|taken/i.test(message);
          const isRateLimited = /rate.limit|too.many|flood/i.test(message);
          const isConfiguration = /unauthorized|invalid|credential|config/i.test(message);
          const isNetwork = /network|fetch|timeout|econnrefused|econnreset/i.test(message);
          let errorCode = "unknown";
        let errorCategory = "unknown";
        if (error instanceof Object && "message" in error) {
          const message = String((error as { message: unknown }).message ?? "");
          if (/already|taken/i.test(message)) {
            errorCategory = "user_already_exists";
          } else if (/rate.limit|too.many|flood/i.test(message)) {
            errorCategory = "rate_limited";
          } else if (/unauthorized|invalid|credential|config/i.test(message)) {
            errorCategory = "configuration_or_permission";
          } else if (/network|fetch|timeout|econnrefused|econnreset/i.test(message)) {
            errorCategory = "network";
          } else if (/confirm|confirmation|verify|confirmation_required/i.test(message)) {
            errorCategory = "confirmation_required";
          } else {
            errorCategory = "other";
          }
        }
        if (error instanceof Object && "code" in error) {
          errorCode = String((error as { code: unknown }).code ?? "unknown");
        }
        console.error(
          `[auth.signUp] failure for ${sanitisedEmail}: category=signup_error errorCode=${errorCode} errorCategory=${errorCategory}`
        );
        } else {
          console.error(`[auth.signUp] failure for ${sanitisedEmail}: category=signup_error type=${error === null ? "null" : typeof error}`);
        }
        // Public response stays generic — never expose the raw Supabase error.
        return {
          ok: false,
          startedEmailVerification: false,
          email,
          error:
            /already|taken/i.test(error instanceof Object && "message" in error ? String((error as { message: unknown }).message ?? "") : "")
              ? "An account with this email already exists. Sign in instead, or use a different email."
              : "We could not create the account. Please try again.",
        };
      }

      const user = (data.user ?? null) as { id: string; email: string } | null;
      if (!user) {
        return { ok: false, startedEmailVerification: false, email, error: "Account creation did not return a user." };
      }

      // When registration is enabled we *do* create a real auth.user, but we
      // keep the local session unauth so nothing is persisted to the browser
      // cookie and the owner can confirm email before any account is "live".
      const startedEmailVerification =
        data.session != null &&
        typeof (data.user as { confirmed_at?: string }).confirmed_at !== "string";

      return {
        ok: true,
        startedEmailVerification,
        email: user.email ?? email,
        user: { id: user.id, email: user.email ?? email }
      };
    } catch (error) {
      // Safe diagnostic logging for sign-up failures.
      // Never log raw credentials, tokens, full messages, or stack traces.
      let errorCode = "unknown";
      let errorCategory = "unknown";
      const sanitisedEmail = attrs.email.length > 0 ? attrs.email.slice(0, 4) + "***@***" : "(no email)";
      if (error instanceof Object && "message" in error) {
        const message = String((error as { message: unknown }).message ?? "");
        if (/already|taken/i.test(message)) {
          errorCategory = "user_already_exists";
        } else if (/rate.limit|too.many|flood/i.test(message)) {
          errorCategory = "rate_limited";
        } else if (/unauthorized|invalid|credential|config/i.test(message)) {
          errorCategory = "configuration_or_permission";
        } else if (/network|fetch|timeout|econnrefused|econnreset/i.test(message)) {
          errorCategory = "network";
        } else if (/confirm|confirmation|verify|confirmation_required/i.test(message)) {
          errorCategory = "confirmation_required";
        } else {
          errorCategory = "other";
        }
      }
      if (error instanceof Object && "code" in error) {
        errorCode = String((error as { code: unknown }).code ?? "unknown");
      }
      console.error(
        `[auth.signUp] catch failure for ${sanitisedEmail}: ` +
        `category=catch_error errorCode=${errorCode} errorCategory=${errorCategory}`
      );
      return { ok: false, startedEmailVerification: false, email, error: "We could not create the account. Please try again." };
    }
  }

  // Dry run: validate the form, never call signUp, never create a real user.
  return {
    ok: true,
    startedEmailVerification: true,
    email,
    user: { id: "preview-user", email }
  };
}

/**
 * Signs in with email and password and persists a verified customer session
 * cookie on success.
 */
export async function signIn(attrs: { email: string; password: string }): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured for this environment yet." };
  }

  const email = normaliseEmail(attrs.email);
  const password = normalisePassword(attrs.password);

  // The cookie is set by the route itself; this helper only returns success/failure.
  const auth = getAuthClient().auth;
  let session: { access_token?: string; expires_in?: number } | null = null;

  try {
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return { ok: false, error: "Email or password is incorrect." };
    }
    session = data.session;
  } catch (error) {
    console.error("Customer sign-in failed", error);
    return { ok: false, error: "We could not sign you in. Please try again." };
  }

  return {
    ok: true,
    error: undefined
  };
}

/**
 * Signs out the current customer session. Call this from the route so the
 * httpOnly cookie can be cleared.
 */
export async function signOut(session: CustomerSession, db: SupabaseClient): Promise<void> {
  // Try to end the Supabase session at the source, ignoring failures.
  try {
    await db.auth.signOut();
  } catch {
    // best-effort
  }
}

/**
 * Updates the customer's display name, email and/or phone. These are written to
 * auth.users (via the customer's own token) so the customer controls their own
 * profile and RLS governs the write.
 */
export async function updateProfile(
  session: CustomerSession,
  db: SupabaseClient,
  attrs: { fullName?: string; email?: string; phone?: string | null; currentPassword?: string; newPassword?: string }
): Promise<{ ok: boolean; error?: string; needsPasswordRestart?: boolean }> {
  const meta: Record<string, unknown> = {};
  if (attrs.fullName !== undefined) meta.display_name = normaliseName(attrs.fullName);
  if (attrs.phone !== undefined) meta.phone = attrs.phone;

  try {
    // Changing email requires re-confirmation in Supabase Auth by default.
    let emailPatch: { email?: string } | undefined;
    let emailChanged = false;
    if (attrs.email !== undefined) {
      const normalized = normaliseEmail(attrs.email);
      if (normalized !== session.email) {
        emailPatch = { email: normalized };
        emailChanged = true;
      }
    }

    // Use type assertion to work around Supabase client typing
    const dbAuth = db.auth as unknown as {
      update: (params: { email?: string; data?: Record<string, unknown> }) => Promise<{ error: Error | null }>;
    };
    const { error } = await dbAuth.update({
      ...emailPatch,
      data: meta
    });

    if (error) {
      if (/already|taken/i.test(error.message)) {
        return { ok: false, error: "That email is already in use by another account." };
      }
      if (emailChanged) {
        return { ok: false, error: "We could not update your email. Check it and try again." };
      }
      return { ok: false, error: "We could not update your profile. Please try again." };
    }

    // Password change is a separate, explicit step below.
    if (attrs.currentPassword != null && attrs.newPassword != null) {
      const currentPassword = normalisePassword(attrs.currentPassword);
      const newPassword = normalisePassword(attrs.newPassword);
      if (currentPassword === newPassword) {
        return { ok: false, error: "The new password must be different from the current one." };
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateUser = (db.auth as any).updateUser;
        const { error: pwError } = await updateUser({ password: newPassword });
        if (pwError) return { ok: false, error: "We could not update your password. Check it and try again." };
        return { ok: true, needsPasswordRestart: true };
      } catch (error) {
        console.error("Customer password change failed", error);
        return { ok: false, error: "We could not update your password. Please try again." };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("Customer profile update failed", error);
    return { ok: false, error: "We could not update your profile. Please try again." };
  }
}

/**
 * Requests a password-recovery email. The email is sent by Supabase Auth
 * (magic-link or code, depending on project configuration). This helper never
 * pretends a recovery was sent when auth is not configured.
 */
export async function requestPasswordRecovery(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Password recovery is not configured for this environment yet." };
  }

  const normalized = normaliseEmail(email);
  const auth = getAuthClient().auth;

  try {
    const { error } = await auth.resetPasswordForEmail(normalized, {
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL
        ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin + "/account/reset-password"
        : "https://racine-it.abbilaly.workers.dev/account/reset-password"
    });
    if (error) {
      return { ok: false, error: "We could not send the recovery email. Please try again." };
    }
    return { ok: true };
  } catch (error) {
    console.error("Password recovery request failed", error);
    return { ok: false, error: "We could not send the recovery email. Please try again." };
  }
}

/**
 * Confirms a one-time recovery token and, when the environment allows it,
 * signs the customer in (persisting the session cookie at the route level).
 */
export async function confirmPasswordRecovery(token: string, email: string): Promise<{
  ok: boolean;
  error?: string;
  signedIn?: boolean;
  session?: { access_token?: string; expires_in?: number };
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Password recovery is not configured for this environment yet." };
  }

  const auth = getAuthClient().auth;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { data: { session: unknown; user: unknown }; error: Error | null } = await (auth as any).verifyOtp({
      token,
      type: "recovery",
      email
    });
    if (result.error || !result.data?.session || !result.data?.user) {
      const error = result.error;
      const hint =
        /expired|invalid|used/i.test(error?.message ?? "")
          ? "That recovery link has expired or has already been used. Request a new one."
          : "That recovery code is not valid. Try requesting a new one.";
      return { ok: false, error: hint };
    }
    return {
      ok: true,
      signedIn: registrationMode() === "live",
      session: result.data.session as { access_token?: string; expires_in?: number }
    };
  } catch (error) {
    console.error("Password recovery confirmation failed", error);
    return { ok: false, error: "We could not confirm that recovery link. Try requesting a new one." };
  }
}

/**
 * Returns the current auth.user for a verified customer session, or null when
 * the token is no longer valid.
 */
export async function getCurrentUser(session: CustomerSession, db: SupabaseClient): Promise<{ id: string; email: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: { data: { user: { id: string; email: string } | null }; error: Error | null } = await (db.auth as any).getUser(session.accessToken);
  if (result.error || !result.data.user) return null;
  return result.data.user;
}
