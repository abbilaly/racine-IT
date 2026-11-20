import { DEFAULT_CURRENCY, formatAmount as formatMoneyAmount, normaliseCurrency } from "@/lib/currency";
import type { OrderDetailRow, QuotationDetailRow } from "@/lib/server/admin-data";
import {
  renderStudioTemplateForSend,
  type StudioSendRender,
} from "@/lib/server/email-template-studio";

/**
 * Bridges stored records to the French studio templates.
 *
 * Real sends never use the studio's sample data: every value below comes from
 * the database row, the request origin or server configuration. If a required
 * variable cannot be produced the render fails with `ok: false` and the caller
 * must refuse to send rather than emit a placeholder to a customer.
 */

export function extractAddress(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const bracketed = raw.match(/<([^>]+)>/);
  const candidate = (bracketed?.[1] ?? raw).trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate) ? candidate : "";
}

function contactEmail(): string {
  return (
    extractAddress(process.env.EMAIL_CONTACT_ADDRESS) ||
    extractAddress(process.env.RESEND_FROM_EMAIL)
  );
}

/**
 * Request origin for links inside emails, derived the same way the send routes
 * derive it from `request.url`, so previews and real sends match.
 */
export function originFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  const proto = (headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim() || "https";
  return `${proto}://${host}`;
}

/**
 * Amount without currency label, in the store currency; the template prints
 * {{currency}} itself, so the two always agree.
 */
function formatAmount(cents: number | null | undefined, currency?: string | null): string {
  // An absent amount returns "" so the strict renderer fails instead of
  // emailing a customer a fabricated 0.
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
  return formatMoneyAmount(cents / 100, currency);
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function summariseItems(
  items: ReadonlyArray<{ qty: number; title: string }>
): { name: string; summary: string } {
  if (items.length === 0) return { name: "", summary: "" };
  const summary = items
    .map(item => `${item.qty} × ${item.title}`)
    .join(" · ")
    .slice(0, 300);
  const name =
    items.length === 1 ? items[0].title : `${items[0].title} (+${items.length - 1} autre(s))`;
  return { name, summary };
}

function readOptional(row: unknown, key: string): string {
  const value = (row as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/* ------------------------------------------------------------------ order */

export function renderOrderConfirmationEmail(
  order: OrderDetailRow,
  options: { origin?: string; currency?: string } = {}
): StudioSendRender {
  const customerName =
    `${order.first_name ?? ""} ${order.last_name ?? ""}`.trim() || order.email;
  const { name, summary } = summariseItems(
    order.order_items.map(item => ({ qty: item.qty, title: item.title }))
  );

  const currency = normaliseCurrency(readOptional(order, "currency") || options.currency);
  const origin = (options.origin ?? "").replace(/\/+$/, "");
  const actionUrl = origin ? `${origin}/order/${encodeURIComponent(order.ref)}` : "";

  return renderStudioTemplateForSend(
    "confirmation_commande",
    {
      customer_name: customerName,
      company_name: readOptional(order, "company") || customerName,
      order_number: order.ref,
      product_name: name || "Commande AB Tech",
      product_summary: summary,
      amount: formatAmount(order.total, currency),
      currency,
      action_url: actionUrl,
      contact_email: contactEmail(),
    },
    { allowMissing: ["action_url"] }
  );
}

/* -------------------------------------------------------------- quotation */

export function renderQuotationEmail(
  quotation: QuotationDetailRow,
  options: { currency?: string } = {}
): StudioSendRender {
  const currency = normaliseCurrency(readOptional(quotation, "currency") || options.currency);
  const { name, summary } = summariseItems(
    quotation.quotation_lines.map(line => ({ qty: line.qty, title: line.title }))
  );

  return renderStudioTemplateForSend(
    "devis",
    {
      customer_name: quotation.customer_name,
      company_name: quotation.customer_company ?? quotation.customer_name,
      quote_number: quotation.ref,
      quote_valid_until: formatDate(quotation.valid_until),
      product_name: name || "Prestation AB Tech",
      product_summary: summary,
      amount: formatAmount(quotation.total_cents, currency),
      currency,
      // There is no public quotation page, so no CTA is rendered.
      action_url: "",
      contact_email: contactEmail(),
    },
    { allowMissing: ["action_url"] }
  );
}

/* ---------------------------------------------------------------- invoice */

export type InvoiceEmailInput = {
  customerName: string;
  companyName?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  /** Total in cents. */
  amountCents: number;
  currency?: string | null;
  invoiceUrl?: string | null;
};

/**
 * Ready-to-attach invoice renderer. The project has no invoice table or route
 * yet, so this is exported for the future invoice module and is not wired to a
 * sending endpoint.
 */
export function renderInvoiceEmail(input: InvoiceEmailInput): StudioSendRender {
  return renderStudioTemplateForSend(
    "facture",
    {
      customer_name: input.customerName,
      company_name: input.companyName ?? input.customerName,
      invoice_number: input.invoiceNumber,
      invoice_date: formatDate(input.invoiceDate),
      due_date: formatDate(input.dueDate),
      amount: formatAmount(input.amountCents, input.currency),
      currency: normaliseCurrency(input.currency),
      action_url: input.invoiceUrl ?? "",
      contact_email: contactEmail(),
    },
    { allowMissing: ["action_url"] }
  );
}
