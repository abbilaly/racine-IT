import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getEmailLog, refreshEmailLogStatus } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await params;

  if (!id || id.trim().length === 0) {
    return fail("Email log id is required.", 400);
  }

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  try {
    const row = await getEmailLog(db, id);
    if (!row) {
      return fail("Email log not found.", 404);
    }
    return NextResponse.json(row);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load email details.",
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await params;
  if (!id || id.trim().length === 0) {
    return fail("Email log id is required.", 400);
  }

  let body: { status?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  const allowed = new Set([
    "pending",
    "sent",
    "delivered",
    "bounced",
    "complained",
    "opened",
    "clicked",
    "failed",
  ]);

  if (!status || !allowed.has(status)) {
    return fail(
      `status must be one of: ${Array.from(allowed).join(", ")}.`,
      400
    );
  }

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  try {
    const row = await refreshEmailLogStatus(db, id, status);
    if (!row) {
      return fail("Email log not found.", 404);
    }
    return NextResponse.json(row);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to update email status.",
      500
    );
  }
}
