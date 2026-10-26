import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "@/lib/server/admin-auth";
import { getAuthClient, getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

type Body = { email?: unknown; password?: unknown };

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured for this environment yet." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const auth = getAuthClient().auth;
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  // A valid Supabase user is not enough: the account must hold an admin role.
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured for this environment yet." },
      { status: 503 }
    );
  }
  const { data: roleRow } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!roleRow) {
    return NextResponse.json(
      { error: "This account does not have administrator access." },
      { status: 403 }
    );
  }

  const maxAge = data.session.expires_in || ADMIN_COOKIE_MAX_AGE;
  const response = NextResponse.json({ ok: true, role: roleRow.role });
  response.cookies.set(ADMIN_COOKIE, data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
  return response;
}
