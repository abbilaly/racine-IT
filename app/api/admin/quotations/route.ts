import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listQuotations, getQuotationDetail, addQuotationLine, removeQuotationLine, recalculateQuotationTotals, createStockAdjustment } from "@/lib/server/admin-data";
import { createQuotation, updateQuotation, addQuotationLineTo, removeQuotationLineFrom, convertQuotationToOrder } from "@/lib/server/quotations";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  try {
    if (type === "detail") {
      const id = url.searchParams.get("id");
      if (!id) return fail("Quotation id is required.", 400);
      const detail = await getQuotationDetail(db, id);
      if (!detail) return NextResponse.json({ quotation: null });
      return NextResponse.json({ quotation: detail });
    }

    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const rawStatus = url.searchParams.get("status");
    const status = !rawStatus || rawStatus === "all" ? undefined : rawStatus;
    const q = url.searchParams.get("q") ?? undefined;

    const { rows, total } = await listQuotations(db, { page, limit, status, q });
    return NextResponse.json({ quotations: rows, total });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load quotations.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  let body: { customerName?: unknown; customerCompany?: unknown; customerEmail?: unknown; customerPhone?: unknown; notes?: unknown; terms?: unknown; validFrom?: unknown; validUntil?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerCompany = typeof body.customerCompany === "string" ? body.customerCompany.trim() : undefined;
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
  const terms = typeof body.terms === "string" ? body.terms.trim() : undefined;
  const validFrom = typeof body.validFrom === "string" ? body.validFrom : undefined;
  const validUntil = typeof body.validUntil === "string" ? body.validUntil : undefined;

  if (!customerName) return fail("Customer name is required.", 400);
  if (!customerEmail) return fail("Customer email is required.", 400);

  try {
    const row = await createQuotation(db, {
      customerName,
      customerCompany,
      customerEmail,
      customerPhone,
      notes,
      terms,
      validFrom,
      validUntil,
    });
    return NextResponse.json({
      id: row.id,
      ref: row.ref,
      status: row.status,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
    }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create quotation.", 500);
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const quotationId = url.searchParams.get("quotationId");
  const lineId = url.searchParams.get("lineId");
  const action = url.searchParams.get("action");

  try {
    if (action === "add-line") {
      if (!quotationId) return fail("Quotation id is required.", 400);
      let body: { product_id?: unknown; slug?: unknown; title?: unknown; qty?: unknown; unit_price_cents?: unknown; line_total_cents?: unknown; discount_percent?: unknown; description?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return fail("The request body must be JSON.", 400);
      }

      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const qty = typeof body.qty === "number" ? body.qty : 1;
      const unitPriceCents = typeof body.unit_price_cents === "number" ? body.unit_price_cents : 0;
      const lineTotalCents = typeof body.line_total_cents === "number" ? body.line_total_cents : unitPriceCents * qty;
      const discountPercent = typeof body.discount_percent === "number" ? body.discount_percent : 0;
      const productId = typeof body.product_id === "string" ? body.product_id.trim() : undefined;
      const description = typeof body.description === "string" ? body.description.trim() : undefined;

      if (!slug) return fail("Product slug is required.", 400);
      if (!title) return fail("Product title is required.", 400);

      const id = await addQuotationLineTo(db, quotationId, {
        product_id: productId,
        slug,
        title,
        qty,
        unit_price_cents: unitPriceCents,
        line_total_cents: lineTotalCents,
        discount_percent: discountPercent,
        description,
      });
      return NextResponse.json({ line_id: id });
    }

    if (action === "remove-line") {
      if (!quotationId || !lineId) return fail("Quotation id and line id are required.", 400);
      await removeQuotationLineFrom(db, quotationId, lineId);
      return NextResponse.json({ ok: true });
    }

    if (action === "recalculate-totals") {
      if (!quotationId) return fail("Quotation id is required.", 400);
      const totals = await recalculateQuotationTotals(db, quotationId);
      return NextResponse.json({ totals });
    }

    if (action === "convert") {
      if (!quotationId) return fail("Quotation id is required.", 400);
      let body: { customerFirstName?: unknown; customerLastName?: unknown; customerEmail?: unknown; customerPhone?: unknown; customerAddress?: unknown; customerCity?: unknown; customerPostal?: unknown; customerCountry?: unknown; delivery?: unknown; payment?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return fail("The request body must be JSON.", 400);
      }

      const customerFirstName = typeof body.customerFirstName === "string" ? body.customerFirstName.trim() : "";
      const customerLastName = typeof body.customerLastName === "string" ? body.customerLastName.trim() : "";
      const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
      const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
      const customerAddress = typeof body.customerAddress === "string" ? body.customerAddress.trim() : "";
      const customerCity = typeof body.customerCity === "string" ? body.customerCity.trim() : "";
      const customerPostal = typeof body.customerPostal === "string" ? body.customerPostal.trim() : "";
      const customerCountry = typeof body.customerCountry === "string" ? body.customerCountry.trim() : "";
      const delivery = body.delivery === "standard" || body.delivery === "express" ? body.delivery : "standard";
      const payment = body.payment === "stripe" || body.payment === "paypal" || body.payment === "invoice" ? body.payment : "invoice";

      if (!customerFirstName) return fail("Customer first name is required.", 400);
      if (!customerLastName) return fail("Customer last name is required.", 400);
      if (!customerEmail) return fail("Customer email is required.", 400);
      if (!customerPhone) return fail("Customer phone is required.", 400);
      if (!customerAddress) return fail("Customer address is required.", 400);
      if (!customerCity) return fail("Customer city is required.", 400);
      if (!customerPostal) return fail("Customer postal code is required.", 400);
      if (!customerCountry) return fail("Customer country is required.", 400);

      const orderId = await convertQuotationToOrder(db, quotationId, {
        customerFirstName,
        customerLastName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerPostal,
        customerCountry,
        delivery,
        payment,
      });
      return NextResponse.json({ order_id: orderId });
    }

    if (!quotationId) return fail("Quotation id is required.", 400);
    let body: { customerName?: unknown; customerCompany?: unknown; customerEmail?: unknown; customerPhone?: unknown; notes?: unknown; terms?: unknown; validFrom?: unknown; validUntil?: unknown; status?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return fail("The request body must be JSON.", 400);
    }

    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : undefined;
    const customerCompany = typeof body.customerCompany === "string" ? body.customerCompany.trim() : undefined;
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : undefined;
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : undefined;
    const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
    const terms = typeof body.terms === "string" ? body.terms.trim() : undefined;
    const validFrom = typeof body.validFrom === "string" ? body.validFrom : undefined;
    const validUntil = typeof body.validUntil === "string" ? body.validUntil : undefined;
    const status = typeof body.status === "string" ? body.status.trim() : undefined;

    const row = await updateQuotation(db, quotationId, {
      customerName,
      customerCompany,
      customerEmail,
      customerPhone,
      notes,
      terms,
      validFrom,
      validUntil,
      status,
    });
    return NextResponse.json({
      id: row.id,
      ref: row.ref,
      status: row.status,
      customer_name: row.customer_name,
      customer_company: row.customer_company,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      notes: row.notes,
      terms: row.terms,
      subtotal_cents: row.subtotal_cents,
      tax_cents: row.tax_cents,
      total_cents: row.total_cents,
      converted_order_id: row.converted_order_id,
      created_at: row.created_at,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update quotation.", 500);
  }
}
