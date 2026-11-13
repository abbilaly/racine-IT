import type { AdminClient } from "@/lib/server/admin-client";
import {
  addQuotationLine,
  removeQuotationLine,
  recalculateQuotationTotals,
  type QuotationRow
} from "@/lib/server/admin-data";

/**
 * Quotation workflows shared by the admin API: creation, updates, line
 * management and the safe conversion of a quotation into an order.
 *
 * Conversion rules:
 *  - a quotation can only be converted once (converted_order_id guard);
 *  - it never charges the customer — the order is stored with the negotiated
 *    totals and the payment method chosen by the admin;
 *  - stock is not decremented here, so an order created from a quotation
 *    behaves like any other manually handled order.
 */

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ORDER_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeQuotationRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return out;
}

function makeOrderRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += ORDER_REF_ALPHABET[b % ORDER_REF_ALPHABET.length];
  return `RIT-${out}`;
}

export type QuotationCreateInput = {
  customerName: string;
  customerCompany?: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  terms?: string;
  validFrom?: string;
  validUntil?: string;
};

export async function createQuotation(db: AdminClient, input: QuotationCreateInput): Promise<QuotationRow> {
  const validFrom = input.validFrom ?? new Date().toISOString();
  const validUntil =
    input.validUntil ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("quotations")
    .insert({
      ref: makeQuotationRef(),
      customer_name: input.customerName,
      customer_company: input.customerCompany ?? null,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone ?? null,
      status: "draft",
      valid_from: validFrom,
      valid_until: validUntil,
      notes: input.notes ?? null,
      terms: input.terms ?? null
    })
    .select(
      "id, ref, customer_name, customer_company, customer_email, customer_phone, status, valid_from, valid_until, notes, terms, subtotal_cents, tax_cents, total_cents, currency, converted_order_id, created_by, created_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return data as QuotationRow;
}

export type QuotationUpdateInput = {
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  terms?: string;
  validFrom?: string;
  validUntil?: string;
  status?: string;
};

const ALLOWED_STATUSES = new Set(["draft", "sent", "accepted", "rejected", "expired"]);

export async function updateQuotation(
  db: AdminClient,
  id: string,
  input: QuotationUpdateInput
): Promise<QuotationRow> {
  if (input.status !== undefined && !ALLOWED_STATUSES.has(input.status)) {
    throw new Error("Invalid quotation status.");
  }

  const patch: Record<string, unknown> = {};
  if (input.customerName !== undefined) patch.customer_name = input.customerName;
  if (input.customerCompany !== undefined) patch.customer_company = input.customerCompany || null;
  if (input.customerEmail !== undefined) patch.customer_email = input.customerEmail;
  if (input.customerPhone !== undefined) patch.customer_phone = input.customerPhone || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.terms !== undefined) patch.terms = input.terms || null;
  if (input.validFrom !== undefined) patch.valid_from = input.validFrom;
  if (input.validUntil !== undefined) patch.valid_until = input.validUntil;
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    throw new Error("Nothing to update.");
  }

  const { data, error } = await db
    .from("quotations")
    .update(patch)
    .eq("id", id)
    .select(
      "id, ref, customer_name, customer_company, customer_email, customer_phone, status, valid_from, valid_until, notes, terms, subtotal_cents, tax_cents, total_cents, currency, converted_order_id, created_by, created_at"
    )
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quotation not found.");
  return data as QuotationRow;
}

/** Adds a line and refreshes the quotation totals. */
export async function addQuotationLineTo(
  db: AdminClient,
  quotationId: string,
  input: {
    product_id?: string;
    slug: string;
    title: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents?: number;
    discount_percent?: number;
    description?: string;
  }
): Promise<string> {
  if (!Number.isInteger(input.qty) || input.qty < 1) {
    throw new Error("Quantity must be a positive whole number.");
  }
  if (!Number.isFinite(input.unit_price_cents) || input.unit_price_cents < 0) {
    throw new Error("Unit price must be zero or more.");
  }
  const lineId = await addQuotationLine(db, quotationId, {
    product_id: input.product_id ?? null,
    slug: input.slug,
    title: input.title,
    qty: input.qty,
    unit_price_cents: Math.round(input.unit_price_cents),
    line_total_cents: Math.round(input.line_total_cents ?? input.unit_price_cents * input.qty),
    discount_percent: input.discount_percent ?? 0,
    description: input.description ?? null
  });
  await recalculateQuotationTotals(db, quotationId);
  return lineId;
}

/** Removes a line and refreshes the quotation totals. */
export async function removeQuotationLineFrom(
  db: AdminClient,
  quotationId: string,
  lineId: string
): Promise<void> {
  await removeQuotationLine(db, quotationId, lineId);
  await recalculateQuotationTotals(db, quotationId);
}

export type ConvertInput = {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerPostal: string;
  customerCountry: string;
  delivery: string;
  payment: string;
};

const PAYMENT_MAP: Record<string, string> = {
  stripe: "card",
  card: "card",
  paypal: "paypal",
  invoice: "cod",
  cod: "cod"
};

const DELIVERY_MAP: Record<string, string> = {
  standard: "standard",
  express: "express"
};

/**
 * Converts a quotation into an order exactly once and returns the order id.
 * Throws when the quotation was already converted.
 */
export async function convertQuotationToOrder(
  db: AdminClient,
  quotationId: string,
  input: ConvertInput
): Promise<string> {
  const { data: quotation, error } = await db
    .from("quotations")
    .select(
      "id, ref, status, converted_order_id, customer_name, customer_email, subtotal_cents, tax_cents, total_cents"
    )
    .eq("id", quotationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quotation) throw new Error("Quotation not found.");
  if (quotation.converted_order_id) {
    throw new Error("This quotation has already been converted to an order.");
  }
  if (quotation.status === "rejected" || quotation.status === "expired") {
    throw new Error(`A ${quotation.status} quotation cannot be converted to an order.`);
  }

  const { data: lines, error: linesError } = await db
    .from("quotation_lines")
    .select("product_id, slug, title, qty, unit_price_cents, line_total_cents, discount_percent")
    .eq("quotation_id", quotationId);
  if (linesError) throw new Error(linesError.message);
  if (!lines || lines.length === 0) {
    throw new Error("Add at least one line before converting this quotation.");
  }

  const orderItems = lines.map((line) => {
    const discount = Number(line.discount_percent ?? 0) / 100;
    return {
      product_id: line.product_id,
      slug: line.slug,
      title: line.title,
      qty: line.qty,
      unit_price: line.unit_price_cents,
      line_total: Math.round(line.line_total_cents * (1 - discount))
    };
  });

  const itemCount = orderItems.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = quotation.subtotal_cents;
  const shipping = 0; // the quoted total already includes everything agreed
  const total = quotation.total_cents;

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      ref: makeOrderRef(),
      status: "received",
      first_name: input.customerFirstName,
      last_name: input.customerLastName,
      email: input.customerEmail,
      phone: input.customerPhone,
      address: input.customerAddress,
      city: input.customerCity,
      postal: input.customerPostal,
      country: input.customerCountry,
      delivery: DELIVERY_MAP[input.delivery] ?? "standard",
      payment: PAYMENT_MAP[input.payment] ?? "cod",
      note: `Converted from quotation ${quotation.ref}`,
      item_count: itemCount,
      subtotal,
      shipping,
      total
    })
    .select("id, ref")
    .single();
  if (orderError) throw new Error(orderError.message);

  for (const item of orderItems) {
    const { error: itemError } = await db.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      slug: item.slug,
      title: item.title,
      unit_price: item.unit_price,
      qty: item.qty,
      line_total: item.line_total
    });
    if (itemError) {
      // roll back so a partial conversion never leaves a half-written order
      await db.from("orders").delete().eq("id", order.id);
      throw new Error(itemError.message);
    }
  }

  const { error: quotationError } = await db
    .from("quotations")
    .update({
      converted_order_id: order.id,
      status: "accepted"
    })
    .eq("id", quotationId);
  if (quotationError) {
    await db.from("order_items").delete().eq("order_id", order.id);
    await db.from("orders").delete().eq("id", order.id);
    throw new Error(quotationError.message);
  }

  return order.id as string;
}