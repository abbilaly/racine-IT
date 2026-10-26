import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase access for the Next.js server runtime.
 *
 * SECURITY: this module is server-only. The service-role key bypasses row
 * level security, so nothing in this file may ever be imported from a
 * component marked "use client" — the browser receives the anon key at most.
 *
 * Required environment variables (set them in .env.local for development, and
 * in Sites → Secrets for a deployed environment):
 *
 *   SUPABASE_URL              https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY server-side key, never shipped to the browser
 *   SUPABASE_ANON_KEY         optional, public key (used for admin sign-in)
 */

export type SupabaseEnv = {
  url: string;
  serviceRoleKey: string;
  anonKey: string | null;
};

function readEnv(): SupabaseEnv | null {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !serviceRoleKey) return null;
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  return { url: url.replace(/\/+$/, ""), serviceRoleKey, anonKey: anonKey || null };
}

/** True once both required variables are present. */
export function isSupabaseConfigured(): boolean {
  return readEnv() !== null;
}

/**
 * Public API client used only for the password sign-in exchange on the server.
 * It carries the anon key, never the service-role key.
 */
export function getAuthClient(): SupabaseClient {
  const env = readEnv();
  if (!env) {
    throw new Error("Supabase is not configured for this environment.");
  }
  return createClient(env.url, env.anonKey ?? env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

let serviceClient: SupabaseClient | null | undefined;

/** Shared service-role client (bypasses RLS — server code only). */
export function getServiceClient(): SupabaseClient | null {
  const env = readEnv();
  if (!env) return null;
  if (serviceClient === undefined) {
    serviceClient = createClient(env.url, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return serviceClient;
}

/**
 * Client bound to an administrator's access token, so every admin query runs
 * under row level security instead of the service role.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const env = readEnv();
  if (!env) {
    throw new Error("Supabase is not configured for this environment.");
  }
  return createClient(env.url, env.anonKey ?? env.serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
