import { NextResponse } from "next/server";
import { getCustomerSession, customerClient } from "@/lib/server/customer-auth";
import { updateProfile } from "@/lib/server/auth";

export async function PATCH(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to update your profile." }, { status: 401 });
  }

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
  const db = customerClient(session);

  const result = await updateProfile(session, db, {
    fullName: typeof raw.fullName === "string" ? raw.fullName : undefined,
    email: typeof raw.email === "string" ? raw.email : undefined,
    phone: typeof raw.phone === "string" ? raw.phone : undefined,
    currentPassword: typeof raw.currentPassword === "string" ? raw.currentPassword : undefined,
    newPassword: typeof raw.newPassword === "string" ? raw.newPassword : undefined
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, needsPasswordRestart: result.needsPasswordRestart ?? false });
}
