import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getEmailMetrics } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const days = Math.min(365, Math.max(1, parseInt(daysParam ?? "90", 10)));

  try {
    const metrics = await getEmailMetrics(db, days);
    return NextResponse.json(metrics);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load email metrics.",
      500
    );
  }
}
