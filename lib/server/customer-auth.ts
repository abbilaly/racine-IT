/**
 * Customer (shopper) authentication for the AB Tech storefront.
 *
 * Built on top of the existing Supabase Auth configuration that already powers
 * the admin dashboard. Customer sessions are separate from admin sessions so a
 * shopper can never be granted admin access and an admin session is never
 * reused as a customer session.
 *
 * Session cookies:
 *   - racine_admin_session   → admin sign-in (admin_roles)
 *   - abtech_customer_session → customer sign-in (no role check)
 *
 * IMPORTANT security note
 * ------------------------
 * Customer-facing reads of orders go through the *verified customer session*
 * (an RLS-scoped client bound to the customer's access token), not through the
 * service-role client. That way Postgres row-level security is the actual
 * boundary: a customer can only see their own orders and their own profile
 * data. See lib/server/auth.ts for the helper that creates that client.
 */

import { cookies } from "next/headers";
import {
  createUserClient,
  getServiceClient,
  isSupabaseConfigured
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Name of the httpOnly cookie that holds a verified customer session. */
export const CUSTOMER_COOKIE = "abtech_customer_session";

/** Fallback lifetime if Supabase does not report one. 7 days. */
export const CUSTOMER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Shape of a verified customer session. */
export type CustomerSession = {
  /** auth.users id of the signed-in customer. */
  userId: string;
  /** Customer email address. */
  email: string;
  /** Access token to create an RLS-scoped client. */
  accessToken: string;
};

/**
 * Profile fields surfaced to the account pages.
 *
 * Phone is mirrored onto auth.users.user_metadata / the auth profile so the
 * storefront can keep the customer's phone in one place and reuse it when
 * placing orders. Editing the profile updates auth.users via the Supabase
 * client bound to the customer's own token, so RLS governs the write.
 */
export type CustomerProfile = {
  /** auth.users id */
  id: string;
  email: string;
  /** Full name, taken from auth.users user_metadata.display_name when present. */
  fullName: string;
  /** Phone, taken from auth.users user_metadata.phone when present. */
  phone: string | null;
  /** UTC ISO timestamp from auth.users created_at. */
  createdAt: string | null;
  /** Whether email verification has been completed. */
  emailConfirmed: boolean;
};

/**
 * Returns the verified customer session, or null when no customer is signed in.
 *
 * Re-validates the access token with Supabase on every request and only trusts
 * tokens that belong to a real auth.user. There is no role check here — anyone
 * with a valid customer account can sign in; admin access is handled separately
 * by lib/server/admin-auth.ts.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  if (!isSupabaseConfigured()) return null;

  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    accessToken: token
  };
}

/**
 * Page guard: redirects anonymous visitors to the sign-in page.
 *
 * This is the customer equivalent of requireAdmin(). It is intentionally
 * separate so a missing customer session redirects to /account/signin, never
 * to /admin/login.
 */
export async function requireCustomer(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    const url = new URL("https://example.test");
    url.pathname = "/account/signin";
    throw new Error(`REDIRECT:${url.pathname}`);
  }
  return session;
}

/**
 * Returns a Supabase client bound to the customer's own access token.
 *
 * Every query made through this client runs under the customer's RLS identity,
 * so Postgres policies decide what the customer may see and change. This is the
 * client used by the account pages and order APIs — never the service-role
 * client.
 */
export function customerClient(session: CustomerSession): SupabaseClient {
  return createUserClient(session.accessToken);
}

/**
 * Returns the current customer profile, or null when not signed in.
 *
 * The storefront keeps the customer's display name and phone in
 * auth.users.user_metadata, so the profile reflects what the user can actually
 * edit from the account page.
 */
export async function getCustomerProfile(
  session: CustomerSession,
  db: SupabaseClient
): Promise<CustomerProfile | null> {
  const { data, error } = await db.auth.getUser(session.accessToken);
  if (error || !data.user) return null;

  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof meta.display_name === "string" ? meta.display_name.trim() : "";
  const phone =
    typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  const emailConfirmed =
    data.user.email_confirmed_at != null ||
    (typeof (data.user as { confirmed_at?: string }).confirmed_at === "string" &&
      (data.user as { confirmed_at?: string }).confirmed_at != null);

  return {
    id: data.user.id,
    email: data.user.email ?? session.email,
    fullName,
    phone,
    createdAt: data.user.created_at ?? null,
    emailConfirmed: Boolean(emailConfirmed)
  };
}
