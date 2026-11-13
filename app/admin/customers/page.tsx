import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listCustomers, formatCents } from "@/lib/server/admin-data";
import { AdminPager, AdminEmptyState } from "@/lib/server/admin-ui";
import Link from "next/link";
import { Users, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  const { rows: customers, total } = await listCustomers(db, { q: params.q, page, limit });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Customers</h1>
          <p className="admin-page-subtitle">
            {total.toLocaleString()} customer{total !== 1 ? "s" : ""} · aggregated from stored orders
          </p>
        </div>
      </div>

      <div className="admin-toolbar">
        <form className="admin-search" method="get" action="/admin/customers">
          <Search size={16} className="admin-icon" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search by name or email…"
            className="admin-search-input"
          />
          <input type="hidden" name="page" value="1" />
        </form>
      </div>

      {customers.length === 0 ? (
        <AdminEmptyState
          icon={<Users size={24} />}
          title="No customers found"
          description="Customers appear here once orders are placed."
        />
      ) : (
        <section className="admin-card admin-card--wide">
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Email</th>
                  <th scope="col">Location</th>
                  <th scope="col">Orders</th>
                  <th scope="col">Total spent</th>
                  <th scope="col">Last order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.email}>
                    <td>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                        className="admin-link-muted"
                      >
                        {customer.name || customer.email}
                      </Link>
                    </td>
                    <td className="admin-muted">{customer.email}</td>
                    <td className="admin-muted">
                      {[customer.city, customer.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>{customer.order_count}</td>
                    <td>{formatCents(customer.total_spent_cents)}</td>
                    <td className="admin-muted">
                      {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AdminPager page={page} totalPages={totalPages} totalItems={total} params={{ q: params.q }} />
    </div>
  );
}