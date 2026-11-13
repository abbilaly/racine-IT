import { NextResponse } from "next/server";
import { requestPasswordRecovery } from "@/lib/server/auth";
import { RATE_LIMITS, checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  // Recovery sends a real email per request; throttle before doing any work.
  const limit = checkRateLimit(request, RATE_LIMITS.passwordRecovery);
  if (!limit.ok) return rateLimitResponse(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "The request body must be an object." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const result = await requestPasswordRecovery(email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error?.includes("not configured") ? 503 : 400 });
  }

  // Always return a neutral success message so an attacker cannot enumerate
  // which addresses are registered.
  return NextResponse.json({ ok: true, message: "If that email is registered, we sent a password-reset link to it." });
}
