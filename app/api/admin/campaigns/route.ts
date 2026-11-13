import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { createCampaignDraftFromForm } from "@/lib/admin-ui";
import { validateSendRequest } from "@/lib/server/email-center";
import { EMAIL_KINDS } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let body: {
    name?: unknown;
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
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

  if (!name) return fail("name is required.", 400);
  if (!EMAIL_KINDS.includes(kind as (typeof EMAIL_KINDS)[number])) {
    return fail(`kind must be one of: ${EMAIL_KINDS.join(", ")}.`, 400);
  }

  const validationError = validateSendRequest(
    testRecipient || manualRecipients[0] || "",
    subject,
    html,
    recipientSelection === "test" ? [testRecipient].filter(Boolean).map((x) => x) : null
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

  const draft = createCampaignDraftFromForm(
    {
      name,
      kind,
      subject,
      html,
      recipientSelection,
      testRecipient,
      manualRecipients,
      createdBy: session.userId,
    },
    session.userId
  );

  return NextResponse.json({ id: draft.id }, { status: 201 });
}

export const dynamic = "force-dynamic";
