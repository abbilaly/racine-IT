import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getOrderDetail } from "@/lib/server/admin-data";
import { createEmailLog, markEmailSent, markEmailFailed } from "@/lib/server/email-center";
import { sendEmail } from "@/lib/server/email";
import { renderOrderConfirmationEmail } from "@/lib/server/email-send-templates";

/**
 * POST { email?, subject?, message? } — sends the customer an order email
 * through Resend from server-side code only.
 *
 * Every attempt is written to email_log first, so retries and failures are
 * visible to administrators. Acceptance by Resend is reported as "sent",
 * never as "delivered".
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: unknown; subject?: unknown; message?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = getAdminClient(session);

  const order = await getOrderDetail(db, id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const to =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : order.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }

  const rendered = renderOrderConfirmationEmail(order, {
    origin: new URL(request.url).origin,
  });
  if (!rendered.ok) {
    return NextResponse.json(
      {
        error: "Le modèle de confirmation de commande est incomplet : données manquantes.",
        missing_variables: rendered.missing,
      },
      { status: 422 }
    );
  }

  const subject =
    (typeof body.subject === "string" && body.subject.trim()) || rendered.subject;
  const html = rendered.html;

  // log the attempt before sending so a crash still leaves a trace
  let logId: string | null = null;
  try {
    logId = await createEmailLog(db, {
      kind: "order_status",
      to_email: to,
      subject,
      body_preview: html.slice(0, 300)
    });
  } catch {
    // logging must never block the send; the send result is still returned
  }

  const result = await sendEmail(to, subject, html);

  if (result.ok) {
    if (logId) {
      try {
        await markEmailSent(db, logId, result.id);
      } catch {
        // ignore log update failures
      }
    }
    return NextResponse.json({ ok: true, provider_message_id: result.id, log_id: logId });
  }

  if (logId) {
    try {
      await markEmailFailed(db, logId, result.error);
    } catch {
      // ignore log update failures
    }
  }
  return NextResponse.json({ ok: false, error: result.error, log_id: logId }, { status: 502 });
}