import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, CUSTOMER_COOKIE_MAX_AGE } from "@/lib/server/customer-auth";
import { getAuthClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { confirmPasswordRecovery } from "@/lib/server/auth";

export async function POST(request: Request) {
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
  const token = typeof raw.token === "string" ? raw.token.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "A recovery code is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Password recovery is not configured for this environment yet." }, { status: 503 });
  }

  // For recovery confirm, we need the email - read from the token params
  const result = await confirmPasswordRecovery(token, "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // When registration is enabled we persist the newly recovered session so the
  // customer is signed back in right away. Otherwise the customer still needs to
  // sign in manually after resetting the password.
  if (result.signedIn && result.session?.access_token) {
    const response = NextResponse.json({
      ok: true,
      message: "Your password was reset successfully. You are now signed in.",
      signedIn: true
    });
    response.cookies.set(CUSTOMER_COOKIE, result.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: result.session.expires_in ?? CUSTOMER_COOKIE_MAX_AGE
    });
    return response;
  }

  return NextResponse.json({
    ok: true,
    message: "Your password was reset successfully. Sign in with your new password.",
    signedIn: false
  });
}
