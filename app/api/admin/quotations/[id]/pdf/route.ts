import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getQuotationDetail, formatCents } from "@/lib/server/admin-data";
import { getStoreSettings } from "@/lib/server/settings";
import { renderQuotationPdf } from "@/lib/server/pdf";

/**
 * GET — downloads the quotation as a dependency-free PDF 1.4 document.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const db = getAdminClient(session);

  try {
    const quotation = await getQuotationDetail(db, id);
    if (!quotation) return new Response("Quotation not found", { status: 404 });

    const settings = await getStoreSettings(db).catch(() => null);
    const storeName = settings?.store_name ?? process.env.STORE_NAME ?? "AB Tech";

    const bytes = renderQuotationPdf({
      storeName,
      ref: quotation.ref,
      customerName: quotation.customer_name,
      customerCompany: quotation.customer_company,
      customerEmail: quotation.customer_email,
      customerPhone: quotation.customer_phone,
      lines: quotation.quotation_lines.map((line) => ({
        title: line.title,
        qty: line.qty,
        unitPrice: formatCents(line.unit_price_cents),
        lineTotal: formatCents(line.line_total_cents),
        discountPercent: line.discount_percent ? Number(line.discount_percent) : undefined
      })),
      subtotal: formatCents(quotation.subtotal_cents),
      tax: formatCents(quotation.tax_cents),
      total: formatCents(quotation.total_cents),
      validFrom: new Date(quotation.valid_from).toLocaleDateString(),
      validUntil: new Date(quotation.valid_until).toLocaleDateString(),
      notes: quotation.notes,
      terms: quotation.terms,
      currency: quotation.currency
    });

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quotation-${quotation.ref}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Could not render PDF", {
      status: 500
    });
  }
}