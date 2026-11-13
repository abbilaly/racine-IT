import { sendEmail, emailConfigured, type SendEmailResult } from "@/lib/server/email";

/**
 * Thin alias kept so routes can talk about "Resend" explicitly while all
 * sending goes through the single tested path in lib/server/email.ts.
 */
export async function sendResendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  return sendEmail(to, subject, html);
}

export { emailConfigured };