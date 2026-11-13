import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { getQuotationDetail, formatCents } from "@/lib/server/admin-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Building2, Calendar } from "lucide-react";
import { AdminBadgeStatus, AdminEmptyState } from "@/lib/server/admin-ui";
import { QuotationActions } from "@/components/admin/QuotationActions";

export const dynamic = "force-dynamic";

export default async function AdminQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { id } = await params;

  const quotation = await getQuotationDetail(db, id);
  if (!quotation) notFound();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link href="/admin/quotations" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to quotations
        </Link>
        <div className="admin-page-title">
          <h1>Quotation {quotation.ref}</h1>
          <p className="admin-page-subtitle">
            <AdminBadgeStatus status={quotation.status} />
            {quotation.converted_order_id && (
              <>
                {" "}
                · converted to{" "}
                <Link href={`/admin/orders/${quotation.converted_order_id}`} className="admin-link">
                  order
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-header">
            <h2>Lines</h2>
            <span className="admin-muted">
              Valid until {new Date(quotation.valid_until).toLocaleDateString()}
            </span>
          </div>
          {quotation.quotation_lines.length === 0 ? (
            <AdminEmptyState
              title="No lines yet"
              description="Add products from the actions panel."
            />
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit price</th>
                    <th scope="col">Discount</th>
                    <th scope="col">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.quotation_lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.title}</td>
                      <td>{line.qty}</td>
                      <td>{formatCents(line.unit_price_cents)}</td>
                      <td>{line.discount_percent ? `${Number(line.discount_percent)}%` : "—"}</td>
                      <td>{formatCents(line.line_total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="admin-definition-list admin-definition-list--inline">
            <div className="admin-definition-row">
              <dt>Subtotal</dt>
              <dd>{formatCents(quotation.subtotal_cents)}</dd>
            </div>
            <div className="admin-definition-row">
              <dt>Tax</dt>
              <dd>{formatCents(quotation.tax_cents)}</dd>
            </div>
            <div className="admin-definition-row admin-definition-row--total">
              <dt>Total</dt>
              <dd>
                <strong>{formatCents(quotation.total_cents)}</strong>
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Customer</h2>
          </div>
          <dl className="admin-definition-list">
            <div className="admin-definition-row">
              <dt>Name</dt>
              <dd>{quotation.customer_name}</dd>
            </div>
            {quotation.customer_company && (
              <div className="admin-definition-row">
                <dt><Building2 size={14} /> Company</dt>
                <dd>{quotation.customer_company}</dd>
              </div>
            )}
            <div className="admin-definition-row">
              <dt><Mail size={14} /> Email</dt>
              <dd>
                <a href={`mailto:${quotation.customer_email}`} className="admin-link">
                  {quotation.customer_email}
                </a>
              </dd>
            </div>
            <div className="admin-definition-row">
              <dt><Phone size={14} /> Phone</dt>
              <dd>{quotation.customer_phone || "—"}</dd>
            </div>
            <div className="admin-definition-row">
              <dt><Calendar size={14} /> Valid from</dt>
              <dd>{new Date(quotation.valid_from).toLocaleDateString()}</dd>
            </div>
          </dl>
          {quotation.notes && (
            <p className="admin-assistive-text">Notes: {quotation.notes}</p>
          )}
          {quotation.terms && (
            <p className="admin-assistive-text">Terms: {quotation.terms}</p>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Actions</h2>
          </div>
          <QuotationActions
            quotationId={quotation.id}
            currentStatus={quotation.status}
            customerName={quotation.customer_name}
            customerEmail={quotation.customer_email}
            lines={quotation.quotation_lines.map((line) => ({
              id: line.id,
              title: line.title,
              qty: line.qty,
            }))}
          />
        </section>
      </div>
    </div>
  );
}