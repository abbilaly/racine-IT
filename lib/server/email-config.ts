/** Server-side email configuration summary that never leaks secret values.

The Email Center uses this for an admin-facing diagnostics view and the existing
webhook diagnostics endpoint. Only booleans and non-secret configuration names
leave the Worker.

Relevant environment (Worker secrets or .env.local):
  - RESEND_API_KEY            Resend API key (sender)
  - RESEND_FROM_EMAIL         verified sender, e.g. orders@yourdomain.com
  - EMAIL_CONTACT_ADDRESS     contact line shown in French template footers
  - EMAIL_TEST_RECIPIENT      address allowed by the test-mode sender
  - RESEND_WEBHOOK_URL        public webhook URL used for event tracking
  - RESEND_WEBHOOK_SECRET     whsec_ signing key for webhook verification
  - RESEND_WEBHOOK_TEST_TOKEN optional whsec_ key used only for signature tests
*/

export type EmailConfigSummary = {
  emailProviderConfigured: boolean;
  fromAddress: ResendSenderConfig;
  contactAddress: ConfigField<"EMAIL_CONTACT_ADDRESS">;
  testMode: {
    restricted: boolean;
    recipientConfigured: boolean;
    recipientValue: string | null;
  };
  webhook: {
    url: string | null;
    secretEnabled: boolean;
    testTokenEnabled: boolean;
  };
  /**
   * Names of additionally relevant environment variables expected by the
   * transactional email system. Returned only as keys, never as values.
   */
  expectedVariables: string[];
  note: string | null;
};

type ResendSenderConfig =
  | { configured: true; presence: boolean }
  | { configured: false; presence: boolean };

type ConfigField<Name extends string> = {
  name: Name;
  /**
   * True when the environment variable exists and is non-empty. A value is
   * present even when it is not a valid email — validation happens elsewhere.
   */
  present: boolean;
  validFormat: boolean;
};

export function emailConfigSummary(): EmailConfigSummary {
  const rawKey = (process.env.RESEND_API_KEY ?? "").trim();
  const rawFrom = (process.env.RESEND_FROM_EMAIL ?? "").trim();
  const rawContact = (process.env.EMAIL_CONTACT_ADDRESS ?? "").trim();
  const rawTestRecipient = (process.env.EMAIL_TEST_RECIPIENT ?? "").trim();

  const keyPresent = rawKey.length > 0;
  const fromPresent = rawFrom.length > 0;
  const contactPresent = rawContact.length > 0;
  const testRecipientPresent = rawTestRecipient.length > 0;

  const emailProviderConfigured = isResendConfigured(rawKey);
  const fromAddress: ResendSenderConfig =
    fromPresent && isResendSenderAddr(rawFrom)
      ? { configured: true, presence: true }
      : { configured: false, presence: fromPresent };

  return {
    emailProviderConfigured,
    fromAddress,
    contactAddress: {
      name: "EMAIL_CONTACT_ADDRESS",
      present: contactPresent,
      validFormat: emailSyNTAXCheck(rawContact),
    },
    testMode: {
      /** Test mode is always enforced: real recipients are rejected server-side. */
      restricted: true,
      recipientConfigured: testRecipientPresent,
      recipientValue: testRecipientPresent ? maskedEmail(rawTestRecipient, 3) : null,
    },
    webhook: {
      url: (process.env.RESEND_WEBHOOK_URL ?? "").trim() || null,
      secretEnabled: Boolean((process.env.RESEND_WEBHOOK_SECRET ?? "").trim()),
      testTokenEnabled: Boolean((process.env.RESEND_WEBHOOK_TEST_TOKEN ?? "").trim()),
    },
    expectedVariables: [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "EMAIL_CONTACT_ADDRESS",
      "EMAIL_TEST_RECIPIENT",
      "RESEND_WEBHOOK_URL",
      "RESEND_WEBHOOK_SECRET",
      "RESEND_WEBHOOK_TEST_TOKEN",
    ],
    note: buildEmailConfigNote({
      emailProviderConfigured,
      fromAddress,
      contactAddress: { present: contactPresent, validFormat: emailSyNTAXCheck(rawContact) },
      testRecipientEnabled: testRecipientPresent,
    }),
  };
}

export function firstEmailDeliverySender(): string {
  return (process.env.RESEND_FROM_EMAIL ?? "").trim() || "onboarding@resend.dev";
}

/* ------------------------------------------------------------------------- helpers */

function isResendConfigured(rawKey: string): boolean {
  // designed to be non-false-positive: any present secret-style value is treated
  // as configured. Do not interpret prefixes or lengths here.
  return rawKey.length > 0;
}

function isResendSenderAddr(raw: string): boolean {
  return emailSyNTAXCheck(raw);
}

function emailSyNTAXCheck(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskedEmail(value: string, visibleChars: number): string {
  if (visibleChars <= 0) return "***@***.***";
  const at = value.indexOf("@");
  if (at < 0) return "*".repeat(visibleChars) + (value.length > visibleChars ? "…@***.***" : "");
  const local = value.slice(0, at);
  const maskedLocal =
    local.length <= visibleChars
      ? local
      : local.slice(0, Math.max(1, visibleChars)) + "…";
  return `${maskedLocal}@***.***`;
}

type BuildNoteInput = {
  emailProviderConfigured: boolean;
  fromAddress: ResendSenderConfig;
  contactAddress: { present: boolean; validFormat: boolean };
  testRecipientEnabled: boolean;
};

function buildEmailConfigNote(input: BuildNoteInput): string | null {
  const {
    emailProviderConfigured,
    fromAddress,
    contactAddress,
    testRecipientEnabled,
  } = input;

  if (!emailProviderConfigured) {
    return "Resend is not configured: set the RESEND_API_KEY Worker secret. Every email send will fail until this is set.";
  }

  if (!fromAddress.configured) {
    if (!fromAddress.presence) {
      return "No RESEND_FROM_EMAIL is set, so every message is sent from onboarding@resend.dev. Use a verified sender (e.g. orders@yourdomain.com) for production.";
    }
    return "RESEND_FROM_EMAIL is set but does not look like a valid email address. Messages will likely be rejected by Resend.";
  }

  if (!testRecipientEnabled) {
    return "No EMAIL_TEST_RECIPIENT is set, so the test-mode send endpoint rejects every recipient. Set the EMAIL_TEST_RECIPIENT Worker secret before sending test messages.";
  }

  if (!contactAddress.present && contactAddress.validFormat === false) {
    return null;
  }

  return null;
}
