import type { AdminClient } from "@/lib/server/admin-client";
import { emailConfigured, sendEmail, SendEmailResult } from "@/lib/server/email";
import type { SupabaseClient } from "@supabase/supabase-js";

// Email-center helpers use a hand-typed Supabase client alias. We intentionally
// keep this loose so the admin modules do not depend on a generated type
// package. The casts below are safe only because every query is maintained
// alongside its normalization code.
type RawRecord = Record<string, unknown>;
type RawSupabaseClient = SupabaseClient;

function asRawClient(client: AdminClient): RawSupabaseClient {
  return client as unknown as RawSupabaseClient;
}

function asFollowupClient(client: AdminClient): RawSupabaseClient {
  return client as unknown as RawSupabaseClient;
}

export type FollowupRuleStatus = "draft" | "active" | "paused" | "cancelled";

export type FollowupTargetType = "quotation" | "order";

export type FollowupJobStatus = "scheduled" | "sent" | "cancelled" | "failed";

export type FollowupTarget =
  | { type: "quotation"; id: string; ref?: string }
  | { type: "order"; id: string; ref?: string };

export interface FollowupRule {
  id: string;
  name: string | undefined;
  targetType: FollowupTargetType;
  targetId: string | undefined;
  initialDelayDays: number;
  templateKind: string;
  subject: string;
  html: string;
  status: FollowupRuleStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  processedCount: number | undefined;
  error: string | null;
}

export interface FollowupJob {
  id: string;
  ruleId: string;
  target: FollowupTarget;
  subject: string;
  html: string;
  scheduledAt: string | undefined;
  sentAt: string | undefined;
  status: FollowupJobStatus;
  error: string | null;
  createdAt: string;
}

export interface CreateFollowupRuleInput {
  targetType: FollowupTargetType;
  targetId?: string;
  initialDelayDays: number;
  templateKind?: string;
  subject: string;
  html: string;
  name?: string;
}

export interface UpdateFollowupRuleInput {
  status?: FollowupRuleStatus;
  error?: string | null;
  processedCount?: number;
}

export const EMAIL_KINDS = [
  "order_confirmation",
  "order_status",
  "quotation",
  "admin_notification",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_STATUS_VALUES = [
  "pending",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "failed",
] as const;
export type EmailStatus = (typeof EMAIL_STATUS_VALUES)[number];

export interface EmailLogRow {
  id: string;
  kind: string;
  to_email: string;
  subject: string;
  body_preview: string | null;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function listEmailLogs(
  db: AdminClient,
  options: {
    q?: string;
    kind?: string;
    status?: string;
    provider?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ rows: EmailLogRow[]; total: number }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, ((options.page ?? 1) - 1) * limit);

  const client = asRawClient(db);
  let query = client
    .from("email_log")
    .select("id, kind, to_email, subject, body_preview, provider, provider_message_id, status, error, created_at, sent_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.kind) query = query.eq("kind", options.kind);
  if (options.status) query = query.eq("status", options.status);
  if (options.provider) query = query.eq("provider", options.provider);
  if (options.q) {
    const q = String(options.q).trim().toLowerCase();
    if (q) {
      query = query.ilike("to_email", `%${q}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as EmailLogRow[],
    total: count ?? 0,
  };
}

export async function createEmailLog(
  db: AdminClient,
  input: {
    kind: string;
    to_email: string;
    subject: string;
    body_preview?: string | null;
    provider?: string;
  }
): Promise<string> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("email_log")
    .insert({
      kind: input.kind,
      to_email: input.to_email,
      subject: input.subject,
      body_preview: input.body_preview ?? null,
      provider: input.provider ?? "resend",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((data as RawRecord).id);
}

export async function markEmailSent(
  db: AdminClient,
  id: string,
  providerMessageId: string
): Promise<void> {
  const client = asRawClient(db);
  const { error } = await client
    .from("email_log")
    .update({ status: "sent", provider_message_id: providerMessageId, sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markEmailFailed(
  db: AdminClient,
  id: string,
  error: string
): Promise<void> {
  const client = asRawClient(db);
  const { error: updateError } = await client
    .from("email_log")
    .update({ status: "failed", error })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
}

export async function markEmailDelivered(
  db: AdminClient,
  id: string
): Promise<void> {
  const client = asRawClient(db);
  const { error } = await client
    .from("email_log")
    .update({ status: "delivered" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markEmailBounced(
  db: AdminClient,
  id: string,
  error: string
): Promise<void> {
  const client = asRawClient(db);
  const { error: updateError } = await client
    .from("email_log")
    .update({ status: "bounced", error })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
}

export async function markEmailComplained(
  db: AdminClient,
  id: string,
  error: string
): Promise<void> {
  const client = asRawClient(db);
  const { error: updateError } = await client
    .from("email_log")
    .update({ status: "complained", error })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
}

export async function markEmailOpened(
  db: AdminClient,
  id: string
): Promise<void> {
  const client = asRawClient(db);
  const { error } = await client
    .from("email_log")
    .update({ status: "opened" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markEmailClicked(
  db: AdminClient,
  id: string
): Promise<void> {
  const client = asRawClient(db);
  const { error } = await client
    .from("email_log")
    .update({ status: "clicked" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function findEmailLogByProviderMessageId(
  db: AdminClient,
  providerMessageId: string
): Promise<EmailLogRow | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("email_log")
    .select("id, kind, to_email, subject, body_preview, provider, provider_message_id, status, error, created_at, sent_at")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as EmailLogRow | null;
}

export async function findEmailLogByRecipientSubject(
  db: AdminClient,
  toEmail: string,
  subject: string
): Promise<EmailLogRow | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("email_log")
    .select("id, kind, to_email, subject, body_preview, provider, provider_message_id, status, error, created_at, sent_at")
    .eq("to_email", String(toEmail).toLowerCase().trim())
    .eq("subject", String(subject).trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as EmailLogRow | null;
}

export async function listFollowupRules(
  db: AdminClient,
  options: { id?: string; status?: string; limit?: number; offset?: number } = {}
): Promise<FollowupRule[]> {
  const client = asRawClient(db);
  let query = client
    .from("followup_rules")
    .select("id, name, target_type, target_id, initial_delay_days, template_kind, subject, html, status, created_by, created_at, updated_at, processed_count, error")
    .order("created_at", { ascending: false });

  if (options.id) query = query.eq("id", options.id);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<RawRecord>;
  return rows.map(normaliseFollowupRule);
}

export async function getFollowupRule(
  db: AdminClient,
  id: string
): Promise<FollowupRule | null> {
  const rows = await listFollowupRules(db, { id, limit: 1 });
  return rows[0] ?? null;
}

export async function createFollowupRule(
  db: AdminClient,
  sessionUserId: string | null,
  input: CreateFollowupRuleInput
): Promise<FollowupRule> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("followup_rules")
    .insert({
      name: input.name ?? null,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      initial_delay_days: input.initialDelayDays,
      template_kind: input.templateKind ?? "quotation",
      subject: input.subject,
      html: input.html,
      status: "draft",
      created_by: sessionUserId,
    })
    .select("id, name, target_type, target_id, initial_delay_days, template_kind, subject, html, status, created_by, created_at, updated_at, processed_count, error")
    .single();
  if (error) throw new Error(error.message);
  return normaliseFollowupRule(data as RawRecord);
}

export async function updateFollowupRule(
  db: AdminClient,
  id: string,
  input: UpdateFollowupRuleInput
): Promise<FollowupRule> {
  const client = asRawClient(db);
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.error !== undefined) patch.error = input.error;
  if (input.processedCount !== undefined) patch.processed_count = input.processedCount;

  const { data, error } = await client
    .from("followup_rules")
    .update(patch)
    .eq("id", id)
    .select("id, name, target_type, target_id, initial_delay_days, template_kind, subject, html, status, created_by, created_at, updated_at, processed_count, error")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Follow-up rule not found.");
  return normaliseFollowupRule(data as RawRecord);
}

export async function pauseFollowupRule(db: AdminClient, id: string): Promise<FollowupRule> {
  return updateFollowupRule(db, id, { status: "paused" });
}

export async function resumeFollowupRule(db: AdminClient, id: string): Promise<FollowupRule> {
  return updateFollowupRule(db, id, { status: "active" });
}

export async function cancelFollowupRule(db: AdminClient, id: string): Promise<FollowupRule> {
  return updateFollowupRule(db, id, { status: "cancelled" });
}

export async function listFollowupJobs(
  db: AdminClient,
  options: { ruleId?: string; targetId?: string; status?: string; limit?: number } = {}
): Promise<FollowupJob[]> {
  const client = asFollowupClient(db);
  let query = client
    .from("followup_jobs")
    .select("id, rule_id, target_type, target_id, target_ref, subject, html, scheduled_at, sent_at, status, error, created_at")
    .order("scheduled_at", { ascending: true });

  if (options.ruleId) query = query.eq("rule_id", options.ruleId);
  if (options.targetId) query = query.eq("target_id", options.targetId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<RawRecord>;
  return rows.map((row) => ({
    id: String(row.id),
    ruleId: String(row.rule_id),
    target:
      row.target_type === "order"
        ? { type: "order" as const, id: String(row.target_id), ref: row.target_ref as string | undefined }
        : { type: "quotation" as const, id: String(row.target_id), ref: row.target_ref as string | undefined },
    subject: String(row.subject),
    html: String(row.html),
    scheduledAt: row.scheduled_at as string | undefined,
    sentAt: row.sent_at as string | undefined,
    status: row.status as FollowupJobStatus,
    error: (row.error as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

export async function createFollowupJob(
  db: AdminClient,
  rule: FollowupRule,
  target: FollowupTarget,
  scheduledAt: string
): Promise<FollowupJob> {
  const client = asFollowupClient(db);
  const { data, error } = await client
    .from("followup_jobs")
    .insert({
      rule_id: rule.id,
      target_type: target.type,
      target_id: target.id,
      target_ref: target.ref ?? null,
      subject: rule.subject,
      html: rule.html,
      scheduled_at: scheduledAt,
      status: "scheduled",
    })
    .select("id, rule_id, target_type, target_id, target_ref, subject, html, scheduled_at, sent_at, status, error, created_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: String(data.id),
    ruleId: String(data.rule_id),
    target:
      data.target_type === "order"
        ? { type: "order" as const, id: String(data.target_id), ref: data.target_ref as string | undefined }
        : { type: "quotation" as const, id: String(data.target_id), ref: data.target_ref as string | undefined },
    subject: String(data.subject),
    html: String(data.html),
    scheduledAt: data.scheduled_at as string | undefined,
    sentAt: data.sent_at as string | undefined,
    status: data.status as FollowupJobStatus,
    error: (data.error as string | null) ?? null,
    createdAt: String(data.created_at),
  };
}

export async function markFollowupJobSent(db: AdminClient, jobId: string): Promise<void> {
  const client = asFollowupClient(db);
  const { error } = await client
    .from("followup_jobs")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function markFollowupJobFailed(db: AdminClient, jobId: string, reason: string): Promise<void> {
  const client = asFollowupClient(db);
  const { error: updateError } = await client
    .from("followup_jobs")
    .update({ status: "failed", error: reason })
    .eq("id", jobId);
  if (updateError) throw new Error(updateError.message);
}

export async function cancelFollowupJob(db: AdminClient, jobId: string): Promise<void> {
  const client = asFollowupClient(db);
  const { error } = await client
    .from("followup_jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function findPendingFollowupJobsForProcessing(
  db: AdminClient,
  nowISO: string
): Promise<Array<{ job: FollowupJob; rule: FollowupRule }>> {
  const client = asFollowupClient(db);
  const { data, error } = await client
    .from("followup_jobs")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowISO)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<RawRecord>;
  const results: Array<{ job: FollowupJob; rule: FollowupRule }> = [];

  for (const row of rows) {
    const job = {
      id: String(row.id),
      ruleId: String(row.rule_id),
      target:
        row.target_type === "order"
          ? { type: "order" as const, id: String(row.target_id), ref: row.target_ref as string | undefined }
          : { type: "quotation" as const, id: String(row.target_id), ref: row.target_ref as string | undefined },
      subject: String(row.subject),
      html: String(row.html),
      scheduledAt: row.scheduled_at as string | undefined,
      sentAt: row.sent_at as string | undefined,
      status: row.status as FollowupJobStatus,
      error: (row.error as string | null) ?? null,
      createdAt: String(row.created_at),
    };

    try {
      const ruleRows = await listFollowupRules(db, { id: job.ruleId, limit: 1 });
      const rule = ruleRows[0];
      if (!rule || rule.status !== "active") {
        await cancelFollowupJob(db, job.id);
        continue;
      }
      results.push({ job, rule });
    } catch {
      await markFollowupJobFailed(db, job.id, "Could not load follow-up rule.");
    }
  }

  return results;
}

export async function findQuotationRefByQuotationId(
  db: AdminClient,
  quotationId: string
): Promise<string | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("quotations")
    .select("ref")
    .eq("id", quotationId)
    .maybeSingle();
  if (error) return null;
  return data?.ref ?? null;
}

export async function findOrderRefByOrderId(
  db: AdminClient,
  orderId: string
): Promise<string | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("orders")
    .select("ref")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return null;
  return data?.ref ?? null;
}

export async function findQuotationStatusByQuotationId(
  db: AdminClient,
  quotationId: string
): Promise<string | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("quotations")
    .select("status")
    .eq("id", quotationId)
    .maybeSingle();
  if (error) return null;
  return data?.status ?? null;
}

export async function findOrderStatusByOrderId(
  db: AdminClient,
  orderId: string
): Promise<string | null> {
  const client = asRawClient(db);
  const { data, error } = await client
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return null;
  return data?.status ?? null;
}

export function isQuotationTerminal(status: string | null): boolean {
  return status === "accepted" || status === "rejected" || status === "expired" || status === null;
}

export function isOrderTerminal(status: string | null): boolean {
  return status === "cancelled" || status === "delivered" || status === null;
}

function normaliseFollowupRule(row: RawRecord): FollowupRule {
  return {
    id: String(row.id),
    name: row.name as string | undefined,
    targetType: row.target_type as FollowupTargetType,
    targetId: row.target_id as string | undefined,
    initialDelayDays: Number(row.initial_delay_days) || 0,
    templateKind: String(row.template_kind ?? "quotation"),
    subject: String(row.subject),
    html: String(row.html),
    status: (row.status as FollowupRuleStatus) ?? "draft",
    createdBy: row.created_by as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    processedCount: (row.processed_count as number) ?? undefined,
    error: (row.error as string | null) ?? null,
  };
}

export function validateSendRequest(
  to: string,
  subject: string,
  html: string,
  allowedRecipients: readonly string[] | null
): string | null {
  if (!to.trim()) return "Recipient email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()))
    return "Recipient email is invalid.";
  if (!subject.trim()) return "Subject is required.";
  if (subject.length > 120) return "Subject must be 120 characters or fewer.";
  if (!html.trim()) return "Email body is required.";
  if (html.length < 5) return "Email body is too short.";
  if (html.length > 50000) return "Email body must be 50000 characters or fewer.";

  if (allowedRecipients && allowedRecipients.length > 0) {
    const allowed = new Set(
      allowedRecipients.map((r) => r.trim().toLowerCase())
    );
    if (!allowed.has(to.trim().toLowerCase())) {
      return "This request can only send to the configured test recipient.";
    }
  }
  return null;
}

export function buildOrderConfirmationHtml(params: {
  storeName: string;
  ref: string;
  customerName: string;
  items: Array<{ title: string; qty: number; price: number; total: number }>;
  shipping: number;
  total: number;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    city: string;
    postal?: string;
  };
}): string {
  const itemRows = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:14px;color:#111827;">${item.title}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;font-size:14px;color:#111827;">${item.qty}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(item.price)}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(item.total)}</td>
      </tr>`
    )
    .join("");

  const shippingRow =
    params.shipping > 0
      ? `<tr><td colspan="3" style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">Livraison</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(params.shipping)}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirmation de commande ${params.ref}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 16px;background-color:#0b2e4f;">
              <h1 style="margin:0;font-size:20px;color:#ffffff;letter-spacing:.2px;">${escapeHtml(params.storeName)}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Confirmation de commande</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;">
                Bonjour ${escapeHtml(params.customerName)},
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;">
                Merci pour votre commande. Votre commande <strong>${escapeHtml(params.ref)}</strong> a bien été enregistrée.
              </p>
              <table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:13px;color:#6b7280;">Produit</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;font-size:13px;color:#6b7280;">Qté</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280;">Prix unitaire</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                  ${shippingRow}
                  <tr>
                    <td colspan="3" style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;color:#111827;">Total</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:700;color:#0b2e4f;">${formatMoney(params.total)}</td>
                  </tr>
                </tbody>
              </table>
              <div style="margin-top:20px;padding:14px 16px;background-color:#fef9e7;border:1px solid #fcd689;border-radius:8px;">
                <p style="margin:0 0 6px;color:#92400e;font-size:13px;font-weight:600;">Adresse de livraison</p>
                <p style="margin:0;color:#374151;font-size:14px;">
                  ${escapeHtml(params.customer.address)}<br />
                  ${escapeHtml(params.customer.city)}${params.customer.postal ? " " + escapeHtml(params.customer.postal) : ""}
                </p>
                ${params.customer.phone ? `<p style="margin:6px 0 0;color:#374151;font-size:14px;">Tél : ${escapeHtml(params.customer.phone)}</p>` : ""}
              </div>
              <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">
                Vous recevrez dès que possible un message avec les instructions de paiement.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                ${escapeHtml(params.storeName)} — Racine IT
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildQuotationEmailHtml(params: {
  storeName: string;
  ref: string;
  customerName: string;
  company?: string;
  items: Array<{ title: string; qty: number; price: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
}): string {
  const itemRows = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:14px;color:#111827;">${escapeHtml(item.title)}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;font-size:14px;color:#111827;">${item.qty}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(item.price)}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(item.total)}</td>
      </tr>`
    )
    .join("");

  const validityRow = `
  <tr style="background-color:#f9fafb;">
    <td colspan="3" style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280;">Valide du</td>
    <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(formatDateRange(params.validFrom, params.validUntil))}</td>
  </tr>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Devis ${params.ref}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 16px;background-color:#0b2e4f;">
              <h1 style="margin:0;font-size:20px;color:#ffffff;letter-spacing:.2px;">${escapeHtml(params.storeName)}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Devis ${escapeHtml(params.ref)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;">
                Bonjour ${escapeHtml(params.customerName)}${params.company ? ", " + escapeHtml(params.company) : ""},
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;">
                Veuillez trouver ci-joint le devis <strong>${escapeHtml(params.ref)}</strong> préparé pour votre demande.
              </p>
              <table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:13px;color:#6b7280;">Désignation</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;font-size:13px;color:#6b7280;">Qté</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280;">Prix unitaire</th>
                    <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280;">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                  ${validityRow}
                  <tr>
                    <td colspan="3" style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;color:#111827;">Total HT</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:700;color:#0b2e4f;">${formatMoney(params.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">TVA</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;color:#111827;">${formatMoney(params.tax)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:700;color:#0b2e4f;">Total TTC</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:700;color:#0b2e4f;">${formatMoney(params.total)}</td>
                  </tr>
                </tbody>
              </table>
              ${params.notes ? `<div style="margin-top:16px;padding:12px 14px;background-color:#f3f4f6;border-left:3px solid #0b2e4f;"><p style="margin:0 0 6px;color:#374151;font-size:13px;font-weight:600;">Notes</p><p style="margin:0;color:#374151;font-size:14px;white-space:pre-line;">${escapeHtml(params.notes)}</p></div>` : ""}
              ${params.terms ? `<div style="margin-top:12px;padding:12px 14px;background-color:#fef2f2;border-left:3px solid #b91c1c;"><p style="margin:0 0 6px;color:#991b1b;font-size:13px;font-weight:600;">Conditions</p><p style="margin:0;color:#374151;font-size:14px;white-space:pre-line;">${escapeHtml(params.terms)}</p></div>` : ""}
              <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">
                Ce devis est valable jusqu’au ${escapeHtml(formatDate(params.validUntil)) || "—"} et est établit à titre indicatif. Les prix et disponibilités sont confirmés lors de la commande.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                ${escapeHtml(params.storeName)} — Racine IT
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateRange(from?: string, until?: string): string {
  const parts: string[] = [];
  if (from) parts.push(formatDate(from));
  if (until) parts.push(formatDate(until));
  return parts.join(" au ") || "—";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

/* ------------------------------------------------------------------ */
/* Sending helpers                                                    */
/* ------------------------------------------------------------------ */

/** True when a Resend API key is present in the server environment. */
export function canSendRealEmail(): boolean {
  return emailConfigured();
}

/**
 * Sends one email through the shared Resend path. In test-only mode the
 * recipient must equal the single configured test address, so no customer can
 * ever receive development mail.
 */
export async function sendTestEmail(
  _db: AdminClient,
  to: string,
  subject: string,
  html: string,
  testOnly: boolean,
  testRecipient: string | null
): Promise<SendEmailResult> {
  if (testOnly) {
    const allowed = (testRecipient ?? "").trim().toLowerCase();
    if (!allowed) {
      return {
        ok: false,
        error: "Test-only mode is enabled but EMAIL_TEST_RECIPIENT is not configured.",
      };
    }
    if (to.trim().toLowerCase() !== allowed) {
      return {
        ok: false,
        error: "Test-only mode can only send to the configured test recipient.",
      };
    }
  }
  return sendEmail(to, subject, html);
}

/* ------------------------------------------------------------------ */
/* Email log reads                                                    */
/* ------------------------------------------------------------------ */

export const EMAIL_LOG_COLUMNS =
  "id, kind, to_email, subject, body_preview, provider, provider_message_id, status, error, created_at, sent_at";

export async function getEmailLog(
  db: AdminClient,
  id: string
): Promise<EmailLogRow | null> {
  const { data, error } = await asRawClient(db)
    .from("email_log")
    .select(EMAIL_LOG_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as EmailLogRow | null;
}

export async function refreshEmailLogStatus(
  db: AdminClient,
  id: string,
  status: string,
  providerMessageId?: string | null,
  errorMessage?: string | null
): Promise<EmailLogRow | null> {
  const patch: RawRecord = { status };
  if (providerMessageId) patch.provider_message_id = providerMessageId;
  if (errorMessage !== undefined) patch.error = errorMessage || null;
  if (status !== "pending" && status !== "sent") {
    patch.last_event_at = new Date().toISOString();
  }

  const { data, error } = await asRawClient(db)
    .from("email_log")
    .update(patch)
    .eq("id", id)
    .select(EMAIL_LOG_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as EmailLogRow | null;
}

/* ------------------------------------------------------------------ */
/* Provider events (idempotent)                                       */
/* ------------------------------------------------------------------ */

/**
 * Stores one provider event. Returns false when the event id was already
 * recorded, which makes webhook retries safe to replay.
 */
export async function recordEmailProviderEvent(
  db: AdminClient,
  input: {
    providerEventId: string;
    emailLogId: string;
    eventType: string;
    payload?: unknown;
  }
): Promise<boolean> {
  const { error } = await asRawClient(db)
    .from("email_events")
    .insert({
      provider: "resend",
      provider_event_id: input.providerEventId,
      email_log_id: input.emailLogId,
      event_type: input.eventType,
      payload: input.payload ?? null,
    });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return false;
    throw new Error(error.message);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Metrics                                                            */
/* ------------------------------------------------------------------ */

export interface EmailMetrics {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  pending: number;
  by_kind: Array<{ kind: string; sent: number; failed: number }>;
}

export async function getEmailMetrics(
  db: AdminClient,
  days = 90
): Promise<EmailMetrics> {
  const since = new Date(Date.now() - Math.max(1, days) * 86_400_000).toISOString();
  const client = asRawClient(db);

  const countFor = async (status?: string): Promise<number> => {
    let query = client
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const [
    total,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    failed,
    pending,
  ] = await Promise.all([
    countFor(),
    countFor("sent"),
    countFor("delivered"),
    countFor("opened"),
    countFor("clicked"),
    countFor("bounced"),
    countFor("complained"),
    countFor("failed"),
    countFor("pending"),
  ]);

  const byKind = new Map<string, { sent: number; failed: number }>();
  const { data, error } = await client
    .from("email_log")
    .select("kind, status")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<RawRecord>) {
    const kind = String(row.kind ?? "other");
    const entry = byKind.get(kind) ?? { sent: 0, failed: 0 };
    const status = String(row.status ?? "");
    if (status === "failed") entry.failed += 1;
    else if (status !== "pending") entry.sent += 1;
    byKind.set(kind, entry);
  }

  return {
    total,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    failed,
    pending,
    by_kind: Array.from(byKind.entries()).map(([kind, value]) => ({ kind, ...value })),
  };
}

/* ------------------------------------------------------------------ */
/* Webhook diagnostics and signature verification                     */
/* ------------------------------------------------------------------ */

export interface WebhookDiagnostics {
  configured: boolean;
  webhook_url: string | null;
  secret_configured: boolean;
  test_token_configured: boolean;
  email_provider_configured: boolean;
  note: string | null;
}

export function getWebhookDiagnostics(): WebhookDiagnostics {
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  const url = (process.env.RESEND_WEBHOOK_URL ?? "").trim() || null;
  const testToken = (process.env.RESEND_WEBHOOK_TEST_TOKEN ?? "").trim();
  return {
    configured: Boolean(secret),
    webhook_url: url,
    secret_configured: Boolean(secret),
    test_token_configured: Boolean(testToken),
    email_provider_configured: emailConfigured(),
    note: secret
      ? null
      : "Set the RESEND_WEBHOOK_SECRET Worker secret before registering the webhook in Resend.",
  };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Resend (Svix) webhook signature. The signed content is
 * `${id}.${timestamp}.${body}` and the secret is a base64 key prefixed with
 * `whsec_`. Unverified payloads must never be trusted.
 */
export async function verifyResendWebhookSignature(
  body: string,
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  toleranceSeconds = 300
): Promise<boolean> {
  if (!body || !secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const rawKey = decodeBase64(secret.replace(/^whsec_/, "").trim());
  const keyBytes = rawKey.buffer.slice(
    rawKey.byteOffset,
    rawKey.byteOffset + rawKey.byteLength
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${body}`)
  );
  const expected = encodeBase64(new Uint8Array(digest));

  return headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const [version, value] = part.split(",");
      return version === "v1" && Boolean(value) && timingSafeEqual(expected, value);
    });
}

/** Maps a Resend event type to the email_log status it represents. */
export function emailStatusForEvent(eventType: string): string | null {
  switch (eventType) {
    case "email.delivered":
    case "delivered":
      return "delivered";
    case "email.bounced":
    case "bounced":
      return "bounced";
    case "email.complained":
    case "complained":
      return "complained";
    case "email.opened":
    case "opened":
      return "opened";
    case "email.clicked":
    case "clicked":
      return "clicked";
    case "email.delivery_delayed":
    case "delivery_delayed":
      return "sent";
    default:
      return null;
  }
}
