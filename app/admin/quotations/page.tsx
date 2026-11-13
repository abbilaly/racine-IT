import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listQuotations, formatCents } from "@/lib/server/admin-data";
import { AdminPager, AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import { QuotationCreateForm } from "@/components/admin/QuotationCreateForm";
import Link from "next/link";
import { FileText, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "draft", "sent", "accepted", "rejected", "expired"];

export default async function AdminQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const status = params.status && params.status !== "all" ? params.status : undefined;

  const { rows: quotations, total } = await listQuotations(db, {
    status,
    q: params.q,
    page,
    limit,
  });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Quotations</h1>
          <p className="admin-page-subtitle">
            {total.toLocaleString()} quotation{total !== 1 ? "s" : ""} · B2B requests kept separate from checkout orders
          </p>
        </div>
        <QuotationCreateForm />
      </div>

      <form className="admin-toolbar" method="get" action="/admin/quotations">
        <div className="admin-search">
          <Search size={16} className="admin-icon" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search reference, name or email…"
            className="admin-search-input"
          />
        </div>
        <div className="admin-filters">
          <label className="admin-filter">
            <span>Status</span>
            <select name="status" defaultValue={params.status ?? "all"} className="admin-select">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page" value="1" />
          <button className="btn-outline" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      {quotations.length === 0 ? (
        <AdminEmptyState
          icon={<FileText size={24} />}
          title="No quotations found"
          description="Create a quotation for a business customer buying in volume."
        />
      ) : (
        <section className="admin-card admin-card--wide">
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Total</th>
                  <th scope="col">Valid until</th>
                  <th scope="col">Order</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td>
                      <Link href={`/admin/quotations/${quotation.id}`} className="admin-link-muted">
                        {quotation.ref}
                      </Link>
                    </td>
                    <td>
                      <span className="admin-product-title">{quotation.customer_name}</span>
                      <br />
                      <span className="admin-muted">{quotation.customer_company || quotation.customer_email}</span>
                    </td>
                    <td>
                      <AdminBadgeStatus status={quotation.status} />
                    </td>
                    <td>{formatCents(quotation.total_cents)}</td>
                    <td className="admin-muted">
                      {new Date(quotation.valid_until).toLocaleDateString()}
                    </td>
                    <td>
                      {quotation.converted_order_id ? (
                        <Link
                          href={`/admin/orders/${quotation.converted_order_id}`}
                          className="admin-link-muted"
                        >
                          View order
                        </Link>
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td className="admin-muted">
                      {new Date(quotation.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AdminPager
        page={page}
        totalPages={totalPages}
        totalItems={total}
        params={{ status: params.status, q: params.q }}
      />
    </div>
  );
}