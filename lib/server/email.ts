/**
 * Transactional email delivery through Resend's official REST API.
 *
 * Uses plain fetch so the project needs no extra dependency. The API key is
 * read from the server-only RESEND_API_KEY environment variable and is never
 * shipped to the browser. When the key is missing every send fails with a
 * clear configuration error instead of silently dropping mail.
 *
 * Required environment (Worker secret or .env.local):
 *   RESEND_API_KEY       Resend API key
 *   RESEND_FROM_EMAIL    verified sender, e.g. orders@yourdomain.com
 */

const API_URL = "https://api.resend.com/emails";

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function fromAddress(): string {
  return (process.env.RESEND_FROM_EMAIL ?? "").trim() || "onboarding@resend.dev";
}

function isConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY ?? "").trim());
}

export function emailConfigured(): boolean {
  return isConfigured();
}

/**
 * Sends one HTML email. Returns the provider message id on acceptance —
 * acceptance by Resend is not proof of delivery, so callers log it as sent
 * only after this returns ok.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) {
    return { ok: false, error: "Invalid recipient address." };
  }
  if (!subject || subject.length > 200) {
    return { ok: false, error: "Invalid subject." };
  }
  if (!html) {
    return { ok: false, error: "Email body is empty." };
  }
  if (!isConfigured()) {
    return {
      ok: false,
      error: "Email is not configured: set the RESEND_API_KEY Worker secret."
    };
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html })
    });

    if (!response.ok) {
      let detail = `Resend responded with HTTP ${response.status}.`;
      try {
        const body = (await response.json()) as { message?: string; error?: { message?: string } };
        detail = body.message ?? body.error?.message ?? detail;
      } catch {
        // keep the HTTP status message when the body is not JSON
      }
      return { ok: false, error: detail };
    }

    const body = (await response.json()) as { id?: string };
    if (!body.id) {
      return { ok: false, error: "Resend accepted the request but returned no message id." };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `Could not reach Resend: ${error.message}` : "Could not reach Resend."
    };
  }
}