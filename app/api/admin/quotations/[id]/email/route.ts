import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getQuotationDetail } from "@/lib/server/admin-data";
import { renderQuotationEmail } from "@/lib/server/email-send-templates";
import { sendEmail } from "@/lib/server/email";
import { createEmailLog, markEmailSent, markEmailFailed } from "@/lib/server/email-center";
import { getStoreCurrency } from "@/lib/server/store-currency";

/**
 * POST — emails the quotation to the business customer through Resend.
 * The attempt is recorded in email_log first, so retries are visible.
 * Acceptance by the provider is reported as "sent", never as "delivered".
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { to?: unknown; sentBy?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const db = getAdminClient(session);

  try {
    const quotation = await getQuotationDetail(db, id);
    if (!quotation) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });

    const to =
      typeof body.to === "string" && body.to.trim() ? body.to.trim() : quotation.customer_email;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
    }

    const rendered = renderQuotationEmail(quotation, { currency: await getStoreCurrency() });
    if (!rendered.ok) {
      return NextResponse.json(
        {
          error: "Le modèle de devis est incomplet : données manquantes.",
          missing_variables: rendered.missing,
        },
        { status: 422 }
      );
    }

    const subject = rendered.subject;
    const html = rendered.html;

    let logId: string | null = null;
    try {
      logId = await createEmailLog(db, {
        kind: "quotation",
        to_email: to,
        subject,
        body_preview: html.slice(0, 300)
      });
    } catch {
      // logging must never block the send
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send quotation email." },
      { status: 500 }
    );
  }
}