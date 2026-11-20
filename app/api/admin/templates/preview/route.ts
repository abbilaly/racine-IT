import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { EMAIL_KINDS } from "@/lib/server/email-center";
import { getStoreCurrency } from "@/lib/server/store-currency";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db;
  try {
    db = getAdminClient(session);
  } catch {
    db = undefined;
  }

  let body: {
    kind?: unknown;
    subject?: unknown;
    html?: unknown;
    preview_params?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const kind =
    typeof body.kind === "string" ? body.kind.trim() : "";
  if (!EMAIL_KINDS.includes(kind as (typeof EMAIL_KINDS)[number])) {
    return fail(
      `kind must be one of: ${EMAIL_KINDS.join(", ")}.`,
      400
    );
  }

  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  const html =
    typeof body.html === "string" ? body.html.trim() : "";

  const previewParams: Record<string, unknown> =
    body.preview_params && typeof body.preview_params === "object"
      ? (body.preview_params as Record<string, unknown>)
      : {};

  let rendered: string | null = null;
  let subjectTemplate: string | null = null;

  if (kind === "order_confirmation") {
    const params = {
      currency:
        typeof previewParams.currency === "string"
          ? previewParams.currency
          : await getStoreCurrency(),
      storeName:
        typeof previewParams.storeName === "string"
          ? previewParams.storeName
          : "AB Tech",
      ref:
        typeof previewParams.ref === "string" ? previewParams.ref : "RIT-00000001",
      customerName:
        typeof previewParams.customerName === "string"
          ? previewParams.customerName
          : "Customer",
      items:
        Array.isArray(previewParams.items)
          ? previewParams.items.map((item) => ({
              title:
                typeof item.title === "string" ? item.title : "Item",
              qty:
                typeof item.qty === "number" ? item.qty : Number(item.qty) || 1,
              price:
                typeof item.price === "number" ? item.price : Number(item.price) || 0,
              total:
                typeof item.total === "number" ? item.total : Number(item.total) || 0,
            }))
          : [],
      shipping:
        typeof previewParams.shipping === "number"
          ? previewParams.shipping
          : Number(previewParams.shipping) || 0,
      total:
        typeof previewParams.total === "number"
          ? previewParams.total
          : Number(previewParams.total) || 0,
      customer: {
        name:
          typeof previewParams.customerName === "string"
            ? previewParams.customerName
            : "Customer",
        email:
          typeof previewParams.email === "string"
            ? previewParams.email
            : "customer@example.com",
        phone:
          typeof previewParams.phone === "string" ? previewParams.phone : undefined,
        address:
          typeof previewParams.address === "string"
            ? previewParams.address
            : "123 Main St",
        city:
          typeof previewParams.city === "string" ? previewParams.city : "City",
        postal:
          typeof previewParams.postal === "string" ? previewParams.postal : undefined,
      },
    };
    let fn;
    try { fn = await import("@/lib/server/email-templates"); } catch { fn = null; }
    if (fn && typeof fn.orderConfirmationTemplate === "function") {
      rendered = fn.orderConfirmationTemplate(params as Parameters<typeof fn.orderConfirmationTemplate>[0]);
      subjectTemplate = `Order confirmed — ${params.ref}`;
    }
  } else if (kind === "quotation") {
    const params = {
      currency:
        typeof previewParams.currency === "string"
          ? previewParams.currency
          : await getStoreCurrency(),
      storeName:
        typeof previewParams.storeName === "string"
          ? previewParams.storeName
          : "AB Tech",
      ref:
        typeof previewParams.ref === "string" ? previewParams.ref : "QTN-00000001",
      customerName:
        typeof previewParams.customerName === "string"
          ? previewParams.customerName
          : "Customer",
      company:
        typeof previewParams.company === "string" ? previewParams.company : undefined,
      items:
        Array.isArray(previewParams.items)
          ? previewParams.items.map((item) => ({
              title:
                typeof item.title === "string" ? item.title : "Item",
              qty:
                typeof item.qty === "number" ? item.qty : Number(item.qty) || 1,
              price:
                typeof item.price === "number" ? item.price : Number(item.price) || 0,
              total:
                typeof item.total === "number" ? item.total : Number(item.total) || 0,
            }))
          : [],
      subtotal:
        typeof previewParams.subtotal === "number"
          ? previewParams.subtotal
          : Number(previewParams.subtotal) || 0,
      tax:
        typeof previewParams.tax === "number" ? previewParams.tax : Number(previewParams.tax) || 0,
      total:
        typeof previewParams.total === "number"
          ? previewParams.total
          : Number(previewParams.total) || 0,
      validFrom:
        typeof previewParams.validFrom === "string" ? previewParams.validFrom : undefined,
      validUntil:
        typeof previewParams.validUntil === "string"
          ? previewParams.validUntil
          : undefined,
      notes:
        typeof previewParams.notes === "string" ? previewParams.notes : undefined,
      terms:
        typeof previewParams.terms === "string" ? previewParams.terms : undefined,
    };
    let fn;
    try { fn = await import("@/lib/server/email-templates"); } catch { fn = null; }
    if (fn && typeof fn.quotationTemplate === "function") {
      rendered = fn.quotationTemplate(params as Parameters<typeof fn.quotationTemplate>[0]);
      subjectTemplate = `Quotation ${params.ref} from AB Tech`;
    }
  }

  return NextResponse.json({
    ok: true,
    kind,
    rendered_html: rendered ?? html,
    subject_template: subjectTemplate ?? (subject || null),
    subject: subject || null,
    html: html || null,
  });
}

export const dynamic = "force-dynamic";
