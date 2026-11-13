import { notFound } from "next/navigation";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getQuotationDetail } from "@/lib/server/admin-data";
import { renderQuotationEmail } from "@/lib/server/email-send-templates";
import { EmailPreviewPanel } from "@/components/admin/EmailPreviewPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aperçu de l'email de devis" };

/**
 * Read-only preview of exactly what POST /api/admin/quotations/[id]/email renders.
 * Nothing is sent, no email_log row is written and no provider call is made.
 */
export default async function QuotationEmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { id } = await params;
  const { device: requestedDevice } = await searchParams;

  const quotation = await getQuotationDetail(db, id);
  if (!quotation) notFound();

  const rendered = renderQuotationEmail(quotation);
  const device = requestedDevice === "mobile" ? "mobile" : "desktop";

  return (
    <EmailPreviewPanel
      title={`Aperçu de l'email — ${quotation.ref}`}
      backHref={`/admin/quotations/${id}`}
      backLabel="Retour au devis"
      sendEndpoint={`POST /api/admin/quotations/${id}/email`}
      recipient={quotation.customer_email}
      subject={rendered.ok ? rendered.subject : ""}
      html={rendered.ok ? rendered.html : null}
      text={rendered.ok ? rendered.text : null}
      missing={rendered.missing}
      device={device}
      deviceHref={next => `/admin/quotations/${id}/email-preview?device=${next}`}
    />
  );
}
