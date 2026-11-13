/**
 * Lightweight rate limiting for public API routes.
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /api/orders`, customer sign-in/sign-up, password recovery and the admin
 * login were all callable without any limit, so a single client could spam
 * orders (each accepted order decrements real inventory), brute-force
 * credentials, or trigger unlimited recovery emails.
 *
 * LIMITS OF THIS IMPLEMENTATION — read before relying on it
 * ---------------------------------------------------------
 * This is an in-process fixed-window counter. On Cloudflare Workers (the
 * deployment target) each isolate has its own memory and isolates are created
 * and destroyed freely, so the effective limit is "per isolate, per window".
 * That still stops a single misbehaving client hammering one instance, but it is
 * NOT a global quota.
 *
 * Address trust: limits are keyed on `cf-connecting-ip` (set by Cloudflare from
 * the real connection, not forgeable by the visitor). Without that header the
 * rightmost valid `x-forwarded-for` entry is used, and when no valid address
 * exists the request is not limited at all rather than being lumped into one
 * shared bucket. Fixed windows can also pass up to twice the limit across a
 * boundary; treat this as a backstop, which is why the edge rule below matters.
 *
 * The real, durable protection is an edge rate-limiting rule (Cloudflare
 * Dashboard → Security → WAF → Rate limiting rules) on:
 *   - /api/orders
 *   - /api/auth/*
 *   - /api/admin/login
 * This module is the in-app backstop for deployments without that rule.
 *
 * No database table, no migration, no external service and no npm dependency is
 * involved — deliberately, so it cannot fail when Supabase is unavailable.
 */

import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

/** Hard cap on tracked keys so a spoofed-IP flood cannot grow memory forever. */
const MAX_TRACKED_KEYS = 5000;

const buckets = new Map<string, Bucket>();

export type RateLimitRule = {
  /** Stable identifier; part of the bucket key. */
  scope: string;
  /** Maximum accepted requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitDenied = { ok: false; retryAfter: number };
export type RateLimitAllowed = { ok: true; remaining: number };
export type RateLimitOutcome = RateLimitAllowed | RateLimitDenied;

/** Shared rules so limits stay consistent across routes. */
export const RATE_LIMITS = {
  /** Guest/customer order creation: 10 orders per IP per 10 minutes. */
  orderCreate: { scope: "orders:create", limit: 10, windowMs: 10 * 60_000 },
  /** Customer sign-in: 10 attempts per IP per 15 minutes. */
  customerSignIn: { scope: "auth:signin", limit: 10, windowMs: 15 * 60_000 },
  /** Customer sign-up: 5 accounts per IP per hour. */
  customerSignUp: { scope: "auth:signup", limit: 5, windowMs: 60 * 60_000 },
  /** Password recovery requests: 5 per IP per hour. */
  passwordRecovery: { scope: "auth:recover", limit: 5, windowMs: 60 * 60_000 },
  /** Administrator sign-in: 10 attempts per IP per 15 minutes. */
  adminSignIn: { scope: "admin:signin", limit: 10, windowMs: 15 * 60_000 }
} as const satisfies Record<string, RateLimitRule>;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/i;

/** Returns a canonical IP string, or null when the value is not an IP address. */
function normaliseAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw.trim().replace(/^"(.*)"$/, "$1").trim();
  if (!value) return null;

  // Some proxies append a port to IPv4: "203.0.113.9:53142".
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(value);
  if (withPort) value = withPort[1];

  // Bracketed IPv6: "[2001:db8::1]".
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);

  if (IPV4.test(value)) return value;
  if (value.includes(":") && IPV6.test(value)) return value.toLowerCase();
  return null;
}

/**
 * Trusted client address, or null when none can be established.
 *
 * On Cloudflare Workers (the deployment target) `cf-connecting-ip` is written by
 * the edge from the real connection: it is a single-value header that Cloudflare
 * overwrites, so a visitor cannot forge it. That is the address every limit is
 * keyed on in production.
 *
 * The `x-forwarded-for` fallback only matters for local/preview servers and any
 * non-Cloudflare host. Each proxy *appends* to that header, which leaves the
 * left-hand entries under the client's control — a spoofable value that would
 * let an attacker rotate the key and bypass the limit. So the chain is walked
 * from the right (closest to us) and only syntactically valid IP addresses are
 * accepted.
 */
export function clientAddress(request: Request): string | null {
  const cf = normaliseAddress(request.headers.get("cf-connecting-ip"));
  if (cf) return cf;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const address = normaliseAddress(hops[index]);
      if (address) return address;
    }
  }

  return null;
}

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized after pruning (many live clients): drop everything rather
  // than grow without bound. Losing counters is preferable to an OOM isolate.
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
}

let warnedMissingAddress = false;

/** Counts one request against `rule` for the caller's address. */
export function checkRateLimit(request: Request, rule: RateLimitRule): RateLimitOutcome {
  const address = clientAddress(request);
  if (!address) {
    // No trustworthy address: do NOT fall back to one shared "unknown" bucket,
    // which would let a single window throttle every visitor at once. Skipping
    // the limit is the safer failure mode for a storefront; warn once per
    // isolate so a deployment that lost its edge headers is noticed.
    if (!warnedMissingAddress) {
      warnedMissingAddress = true;
      console.warn(
        "[rate-limit] no trustworthy client address on this request — per-IP limits are inactive for this isolate."
      );
    }
    return { ok: true, remaining: rule.limit };
  }

  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) prune(now);

  const key = `${rule.scope}:${address}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1 };
  }

  if (bucket.count >= rule.limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true, remaining: rule.limit - bucket.count };
}

/**
 * Standard 429 response. The message is intentionally generic and does not
 * reveal the configured limit or window.
 */
export function rateLimitResponse(
  denied: RateLimitDenied,
  message = "Too many requests. Please wait a moment and try again."
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(denied.retryAfter) } }
  );
}

/** Test-only helper: clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
