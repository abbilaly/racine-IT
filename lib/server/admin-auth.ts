import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createUserClient,
  getServiceClient,
  isSupabaseConfigured
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Administrator sessions are Supabase Auth sessions kept in an httpOnly
 * cookie. Every admin request re-verifies the access token with Supabase and
 * re-checks admin_roles, so hiding admin links or routes is never the
 * security boundary.
 */

export const ADMIN_COOKIE = "racine_admin_session";
/** Fallback cookie lifetime when Supabase does not report one. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60;

export type AdminSession = {
  userId: string;
  email: string;
  accessToken: string;
  role: string;
};

/** Returns the verified administrator session, or null when not signed in. */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;

  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  // Role lookup runs through an RLS-scoped client for this user, so the
  // database — not the UI — decides whether they are an administrator.
  const userClient = createUserClient(token);
  const { data: roleRow } = await userClient
    .from("admin_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!roleRow) return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    accessToken: token,
    role: roleRow.role
  };
}

/** Page guard: redirects anonymous visitors to the admin sign-in page. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** API guard: returns null instead of throwing, so routes can send a 401. */
export async function getAdminApiSession(): Promise<AdminSession | null> {
  return getAdminSession();
}

/** Data client for admin screens: the administrator's own token, under RLS. */
export function adminClient(session: AdminSession): SupabaseClient {
  return createUserClient(session.accessToken);
}
