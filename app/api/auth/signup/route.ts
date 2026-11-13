import { NextResponse } from "next/server";
import { signUp } from "@/lib/server/auth";
import { RATE_LIMITS, checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, RATE_LIMITS.customerSignUp);
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
  const fullName = typeof raw.fullName === "string" ? raw.fullName : "";
  const email = typeof raw.email === "string" ? raw.email : "";
  const phone = typeof raw.phone === "string" ? raw.phone : null;
  const password = typeof raw.password === "string" ? raw.password : "";
  const confirmPassword = typeof raw.confirmPassword === "string" ? raw.confirmPassword : "";

  if (!fullName.trim()) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!email.trim()) {
    return NextResponse.json({ error: "Email address is required." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "A password is required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "The passwords do not match." }, { status: 400 });
  }

  let result: { ok: boolean; startedEmailVerification: boolean; email: string; error?: string; user?: { id: string; email: string } } | null = null;
  try {
    result = await signUp({ fullName, email, phone, password });
  } catch (err) {
    // Validation helpers throw on invalid input; treat as a 400 validation error.
    console.error("[auth.signup.route] validation threw an error:", err instanceof Object && "message" in err ? String((err as { message: unknown }).message).slice(0, 120) : String(err));
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 }
    );
  }

  if (!result || !result.ok) {
    return NextResponse.json({ error: result?.error ?? "We could not create the account. Please try again." }, { status: result?.error?.includes("Supabase is not configured") ? 503 : 400 });
  }

  // Dry-run (default): validate the form and return the email-verification
  // screen without creating a real account or sending a real email.
  return NextResponse.json({
    ok: true,
    email: result.email,
    startedEmailVerification: result.startedEmailVerification,
    accountCreated: result.user != null && result.user.id !== "preview-user"
  });
}
