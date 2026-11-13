import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  canSendRealEmail,
  sendTestEmail,
  createEmailLog,
  markEmailSent,
  markEmailFailed,
  validateSendRequest,
} from "@/lib/server/email-center";
import { EMAIL_KINDS } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
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

  if (!canSendRealEmail()) {
    return fail("Email provider is not configured.", 503);
  }

  const testOnly = true;
  let testRecipient: string | null = null;
  if (testOnly) {
    testRecipient =
      (typeof process.env.EMAIL_TEST_RECIPIENT === "string"
        ? process.env.EMAIL_TEST_RECIPIENT.trim()
        : "") || null;
    if (!testRecipient) {
      return fail(
        "Test-only mode is enabled but EMAIL_TEST_RECIPIENT is not configured.",
        503
      );
    }
  }

  let body: {
    to?: unknown;
    subject?: unknown;
    html?: unknown;
    kind?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const html = typeof body.html === "string" ? body.html.trim() : "";
  const rawKind =
    typeof body.kind === "string" ? body.kind.trim() : "admin_notification";

  if (!EMAIL_KINDS.includes(rawKind as (typeof EMAIL_KINDS)[number])) {
    return fail(
      `kind must be one of: ${EMAIL_KINDS.join(", ")}.`,
      400
    );
  }

  const validationError = validateSendRequest(
    to,
    subject,
    html,
    testOnly ? (testRecipient ? [testRecipient] : null) : null
  );
  if (validationError) return fail(validationError, 400);

  const kind = rawKind as (typeof EMAIL_KINDS)[number];
  const logId = await createEmailLog(db, {
    kind,
    to_email: to,
    subject,
    body_preview: html.slice(0, 500),
  });

  const result = await sendTestEmail(
    db,
    to,
    subject,
    html,
    testOnly,
    testRecipient
  );

  if (result.ok) {
    await markEmailSent(db, logId, result.id!);
    return NextResponse.json({
      ok: true,
      provider_message_id: result.id,
      log_id: logId,
      test_only: testOnly,
    });
  }

  await markEmailFailed(db, logId, result.error ?? "Unknown failure.");
  return NextResponse.json(
    {
      ok: false,
      error: result.error ?? "Failed to send email.",
      log_id: logId,
      test_only: testOnly,
    },
    { status: 500 }
  );
}

export const dynamic = "force-dynamic";
