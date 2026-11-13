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
 * Bounded Supabase requests.
 *
 * Supabase calls previously had no application-level timeout, so a stalled
 * response held the invocation open until the platform cut it: every shared
 * page was as slow as the slowest dependency, and a request could outlive the
 * response it was fetched for. These bounds make the failure cheap and explicit
 * instead:
 *
 *  - reads (GET/HEAD) get `SUPABASE_READ_TIMEOUT_MS`, deliberately shorter than
 *    the 4 s shell budget in `app/layout.tsx`, so the layout's race and the
 *    catalogue read settle together instead of leaving an orphaned request
 *    running behind an already-rendered page;
 *  - writes (POST/PATCH/PUT/DELETE — this includes the `create_order` RPC and
 *    the auth calls) get `SUPABASE_WRITE_TIMEOUT_MS`. It is kept generous on
 *    purpose: aborting a transaction that has already committed would turn a
 *    saved order into an "unknown outcome" for the customer.
 *
 * A caller's own AbortSignal is still honoured — it is merged with the timeout
 * rather than replaced, so explicit cancellation keeps working.
 */
export const SUPABASE_READ_TIMEOUT_MS = 3000;
export const SUPABASE_WRITE_TIMEOUT_MS = 10_000;

function timeoutForMethod(method: string | undefined): number {
  const normalised = (method ?? "GET").toUpperCase();
  return normalised === "GET" || normalised === "HEAD"
    ? SUPABASE_READ_TIMEOUT_MS
    : SUPABASE_WRITE_TIMEOUT_MS;
}

/** Joins abort signals: `AbortSignal.any` when available, manual fallback otherwise. */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];

  const anySignal = (AbortSignal as unknown as { any?: (list: AbortSignal[]) => AbortSignal }).any;
  if (typeof anySignal === "function") return anySignal.call(AbortSignal, signals);

  const controller = new AbortController();
  const abortWith = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };
  for (const signal of signals) {
    if (signal.aborted) {
      abortWith(signal);
      break;
    }
    signal.addEventListener("abort", () => abortWith(signal), { once: true });
  }
  return controller.signal;
}

function abortError(message: string): Error {
  const error = new Error(message);
  // postgrest-js treats AbortError as final: it does not replay the request.
  error.name = "AbortError";
  return error;
}

/**
 * `fetch` with a per-request time bound, injected into every Supabase client.
 *
 * An abort surfaces as an ordinary Supabase error, so existing callers keep
 * their current handling — catalogue reads throw `catalogue-unavailable`, order
 * writes return the generic failure — instead of needing new error branches.
 */
export async function supabaseFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  // postgrest-js replays a failed GET/HEAD up to three times with exponential
  // backoff (3 s of bound became a measured ~19 s stall). A retry means the
  // first attempt already failed, so inside a server render we finish the read
  // instead of replaying it and multiplying load on an unhealthy dependency.
  if (new Headers(init.headers).has("x-retry-count")) {
    throw abortError("Supabase request retry skipped: the first attempt already failed.");
  }

  const timeoutMs = timeoutForMethod(init.method);
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? combineSignals([init.signal, timeout]) : timeout;

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeout.aborted) throw abortError(`Supabase request timed out after ${timeoutMs} ms.`);
    if (init.signal?.aborted) throw abortError("Supabase request was cancelled by the caller.");
    throw error;
  }
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
    global: { fetch: supabaseFetch },
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
      global: { fetch: supabaseFetch },
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
    global: { headers: { Authorization: `Bearer ${accessToken}` }, fetch: supabaseFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
