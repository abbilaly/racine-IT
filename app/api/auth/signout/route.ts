import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { CUSTOMER_COOKIE } from "@/lib/server/customer-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Best-effort server-side sign-out; the cookie is always cleared.
  try {
    const supabase = getServiceClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignore
  }

  response.cookies.set(CUSTOMER_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0
  });
  return response;
}
