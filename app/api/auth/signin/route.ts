import { NextResponse } from "next/server";
import { getAuthClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_COOKIE_MAX_AGE,
  type CustomerSession
} from "@/lib/server/customer-auth";
import { RATE_LIMITS, checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, RATE_LIMITS.customerSignIn);
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
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const remember = raw.remember === true || String(raw.remember).toLowerCase() === "true";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "A password is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Sign in is not configured for this environment yet." }, { status: 503 });
  }

  const auth = getAuthClient().auth;
  try {
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const session = data.session;
    const maxAge = session.expires_in ?? CUSTOMER_COOKIE_MAX_AGE;
    const response = NextResponse.json({
      ok: true,
      email: data.user.email ?? email
    });
    response.cookies.set(CUSTOMER_COOKIE, session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge
    });
    return response;
  } catch (error) {
    console.error("Customer sign-in failed", error);
    return NextResponse.json({ error: "We could not sign you in. Please try again." }, { status: 503 });
  }
}
