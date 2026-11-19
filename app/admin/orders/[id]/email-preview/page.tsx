import { headers } from "next/headers";
import { isUuid } from "@/lib/utils";
import { notFound } from "next/navigation";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getOrderDetail } from "@/lib/server/admin-data";
import {
  originFromHeaders,
  renderOrderConfirmationEmail,
} from "@/lib/server/email-send-templates";
import { EmailPreviewPanel } from "@/components/admin/EmailPreviewPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aperçu de l'email de commande" };

/**
 * Read-only preview of exactly what POST /api/admin/orders/[id]/email renders.
 * Nothing is sent, no email_log row is written and no provider call is made.
 */
export default async function OrderEmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { id } = await params;
  // A malformed id must be a 404, not a database error screen.
  if (!isUuid(id)) notFound();
  const { device: requestedDevice } = await searchParams;

  const order = await getOrderDetail(db, id);
  if (!order) notFound();

  const origin = originFromHeaders(await headers());
  const rendered = renderOrderConfirmationEmail(order, { origin });
  const device = requestedDevice === "mobile" ? "mobile" : "desktop";

  return (
    <EmailPreviewPanel
      title={`Aperçu de l'email — ${order.ref}`}
      backHref={`/admin/orders/${id}`}
      backLabel="Retour à la commande"
      sendEndpoint={`POST /api/admin/orders/${id}/email`}
      recipient={order.email}
      subject={rendered.ok ? rendered.subject : ""}
      html={rendered.ok ? rendered.html : null}
      text={rendered.ok ? rendered.text : null}
      missing={rendered.missing}
      device={device}
      deviceHref={next => `/admin/orders/${id}/email-preview?device=${next}`}
    />
  );
}
