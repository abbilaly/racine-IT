import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import type { AdminClient } from "@/lib/server/admin-client";
import {
  emailStatusForEvent,
  findEmailLogByProviderMessageId,
  findEmailLogByRecipientSubject,
  recordEmailProviderEvent,
  refreshEmailLogStatus,
  verifyResendWebhookSignature,
} from "@/lib/server/email-center";

type Payload = {
  id?: unknown;
  type?: unknown;
  created_at?: unknown;
  data?: {
    email_id?: unknown;
    id?: unknown;
    to?: unknown;
    subject?: unknown;
    bounce?: { message?: unknown };
  };
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resend (Svix) webhook. The provider authenticates with its signature, so this
 * route deliberately does not require an admin browser session. Nothing is read
 * or written before the signature over the raw body has been verified.
 */
export async function POST(request: Request) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return fail("Resend webhook verification is not configured.", 503);
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return fail("Could not read the request body.", 400);
  }

  const verified = await verifyResendWebhookSignature(bodyText, secret, {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  });
  if (!verified) {
    return fail("Invalid webhook signature.", 401);
  }

  let payload: Payload;
  try {
    payload = JSON.parse(bodyText) as Payload;
  } catch {
    return fail("Invalid webhook payload.", 400);
  }

  const eventId = text(payload.id);
  const eventType = text(payload.type);
  if (!eventId || !eventType) {
    return fail("Webhook payload is missing an event id or type.", 400);
  }

  const status = emailStatusForEvent(eventType);
  if (!status) {
    return NextResponse.json({ ok: true, processed: false, reason: "ignored_event" });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return fail("Supabase is not configured for this environment.", 503);
  }
  const db = supabase as unknown as AdminClient;

  const data = payload.data ?? {};
  const providerMessageId = text(data.email_id) || text(data.id);
  const recipient = text(data.to).toLowerCase();
  const subject = text(data.subject);

  try {
    let log = providerMessageId
      ? await findEmailLogByProviderMessageId(db, providerMessageId)
      : null;
    if (!log && recipient && subject) {
      log = await findEmailLogByRecipientSubject(db, recipient, subject);
    }
    if (!log) {
      // Acknowledge so the provider stops retrying an event we cannot match.
      return NextResponse.json({ ok: true, processed: false, reason: "no_local_match" });
    }

    const isNew = await recordEmailProviderEvent(db, {
      providerEventId: eventId,
      emailLogId: log.id,
      eventType,
      payload,
    });
    if (!isNew) {
      return NextResponse.json({ ok: true, processed: false, reason: "duplicate_event" });
    }

    const errorMessage =
      status === "bounced" || status === "complained"
        ? text(data.bounce?.message) || eventType
        : undefined;

    await refreshEmailLogStatus(db, log.id, status, providerMessageId, errorMessage);

    return NextResponse.json({ ok: true, processed: true, status });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to process the webhook event.",
      500
    );
  }
}

export const dynamic = "force-dynamic";
