import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  sendTestEmail,
  validateSendRequest,
  createEmailLog,
  markEmailSent,
  markEmailFailed,
} from "@/lib/server/email-center";
import { EMAIL_KINDS } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await params;
  if (!id) return fail("Campaign id is required.", 400);

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  let body: {
    kind?: unknown;
    subject?: unknown;
    html?: unknown;
    recipientSelection?: unknown;
    testRecipient?: unknown;
    manualRecipients?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const html = typeof body.html === "string" ? body.html.trim() : "";
  const recipientSelection =
    typeof body.recipientSelection === "string"
      ? body.recipientSelection.trim()
      : "manual";
  const testRecipient =
    typeof body.testRecipient === "string" ? body.testRecipient.trim() : "";
  const manualRecipients =
    Array.isArray(body.manualRecipients)
      ? body.manualRecipients.filter((r) => typeof r === "string").map((r) => r.trim())
      : [];

  if (!EMAIL_KINDS.includes(kind as (typeof EMAIL_KINDS)[number])) {
    return fail(`kind must be one of: ${EMAIL_KINDS.join(", ")}.`, 400);
  }

  const validationError = validateSendRequest(
    testRecipient || manualRecipients[0] || "",
    subject,
    html,
    recipientSelection === "test" ? [testRecipient].filter(Boolean) ?? null : null
  );
  if (validationError) return fail(validationError, 400);

  if (recipientSelection !== "test" && recipientSelection !== "manual") {
    return fail('recipientSelection must be "test" or "manual".', 400);
  }

  if (recipientSelection === "test" && !testRecipient) {
    return fail("testRecipient is required when recipientSelection is test.", 400);
  }
  if (recipientSelection === "manual" && manualRecipients.length === 0) {
    return fail("manualRecipients must include at least one address.", 400);
  }

  const recipient = recipientSelection === "test" ? testRecipient : manualRecipients[0]!;
  const logId = await createEmailLog(db, {
    kind,
    to_email: recipient,
    subject,
    body_preview: html.slice(0, 500),
  });

  const result = await sendTestEmail(db, recipient, subject, html, true, testRecipient);

  if (result.ok) {
    await markEmailSent(db, logId, result.id!);
    return NextResponse.json({
      ok: true,
      provider_message_id: result.id,
      log_id: logId,
    });
  }

  await markEmailFailed(db, logId, result.error ?? "Failed to send campaign email.");
  return NextResponse.json(
    {
      ok: false,
      error: result.error ?? "Failed to send campaign email.",
      log_id: logId,
    },
    { status: 500 }
  );
}

export const dynamic = "force-dynamic";
