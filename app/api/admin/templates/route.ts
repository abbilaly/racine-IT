import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { orderConfirmationTemplate, quotationTemplate } from "@/lib/server/email-templates";
import { EMAIL_KINDS } from "@/lib/server/email-center";
import type { OrderTemplateParams } from "@/lib/server/email-templates";
import type { QuotationTemplateParams } from "@/lib/server/email-templates";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  return NextResponse.json({
    templates: EMAIL_KINDS.map((kind) => ({
      kind,
      label:
        kind === "order_confirmation"
          ? "Order confirmation"
          : kind === "order_status"
          ? "Order status update"
          : kind === "quotation"
          ? "Quotation"
          : "Admin notification",
      html: null,
      subject_template: null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let body: { kind?: unknown; preview_params?: unknown; subject?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const kind =
    typeof body.kind === "string"
      ? body.kind.trim()
      : (typeof body.kind === "string" ? body.kind : "");
  if (!EMAIL_KINDS.includes(kind as (typeof EMAIL_KINDS)[number])) {
    return fail(
      `kind must be one of: ${EMAIL_KINDS.join(", ")}.`,
      400
    );
  }

  const previewParams: Record<string, unknown> =
    body.preview_params && typeof body.preview_params === "object"
      ? (body.preview_params as Record<string, unknown>)
      : {};

  let html: string | null = null;
  let subjectTemplate: string | null = null;

  if (kind === "order_confirmation") {
    const params: OrderTemplateParams = {
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
    html = orderConfirmationTemplate(params);
    subjectTemplate = `Order confirmed — ${params.ref}`;
  } else if (kind === "quotation") {
    const params: QuotationTemplateParams = {
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
    html = quotationTemplate(params);
    subjectTemplate = `Quotation ${params.ref} from AB Tech`;
  }

  return NextResponse.json({
    kind,
    html,
    subject_template: subjectTemplate,
  });
}

export const dynamic = "force-dynamic";
