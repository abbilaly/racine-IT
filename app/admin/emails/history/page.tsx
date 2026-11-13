import Link from "next/link";
import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listEmailLogs, EMAIL_KINDS } from "@/lib/server/email-center";
import { AdminBreadcrumbs } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email history" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function EmailHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAdmin();
  const params = await searchParams;

  const q = readParam(params.q);
  const kind = readParam(params.kind);
  const status = readParam(params.status);
  const page = Math.max(1, parseInt(readParam(params.page) || "1", 10) || 1);
  const limit = 50;

  let rows: Awaited<ReturnType<typeof listEmailLogs>>["rows"] = [];
  let total = 0;
  let error: string | null = null;
  try {
    const result = await listEmailLogs(adminClient(session), {
      q: q || undefined,
      kind: kind || undefined,
      status: status || undefined,
      page,
      limit,
    });
    rows = result.rows;
    total = result.total;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load email history.";
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageHref = (target: number) =>
    `/admin/emails/history?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(
      kind
    )}&status=${encodeURIComponent(status)}&page=${target}`;

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "History" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Email history</h1>
          <p className="admin-page-subtitle">
            Every application send request and the provider status recorded for it.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link href="/admin/emails/history/new" className="btn-dark">
            Send test email
          </Link>
        </div>
      </header>

      <form className="ec-filters" method="get" action="/admin/emails/history">
        <div className="ec-field ec-field--search">
          <label htmlFor="ec-filter-q">Recipient</label>
          <input
            id="ec-filter-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="customer@example.com"
            inputMode="email"
          />
        </div>
        <div className="ec-field">
          <label htmlFor="ec-filter-kind">Type</label>
          <select id="ec-filter-kind" name="kind" defaultValue={kind}>
            <option value="">All types</option>
            {EMAIL_KINDS.map(item => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="ec-field">
          <label htmlFor="ec-filter-status">Status</label>
          <select id="ec-filter-status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {["pending", "sent", "delivered", "opened", "clicked", "bounced", "complained", "failed"].map(
              item => (
                <option key={item} value={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>
        <div className="ec-filters-actions">
          <button type="submit" className="btn-dark">
            Filter
          </button>
        </div>
      </form>

      {error ? (
        <div className="admin-error" role="alert">
          <strong>Email history unavailable</strong>
          <p>{error}</p>
          <p>
            If the email log table is missing, apply the email center migration before
            using this page.
          </p>
        </div>
      ) : (
        <>
          <div className="ec-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.subject}</td>
                    <td>{row.to_email}</td>
                    <td>
                      <span className="admin-badge">{row.kind.replace(/_/g, " ")}</span>
                    </td>
                    <td>
                      <span className={`admin-status admin-status--${row.status}`}>{row.status}</span>
                    </td>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</td>
                    <td>
                      <Link href={`/admin/emails/history/${row.id}`} className="ec-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <span className="ec-empty">No emails match these filters yet.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav className="ec-pagination" aria-label="Pagination">
            <span>
              Page {page} of {totalPages} · {total} email{total === 1 ? "" : "s"}
            </span>
            <span className="ec-pagination-links">
              {page > 1 && (
                <Link className="ec-link" href={pageHref(page - 1)}>
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link className="ec-link" href={pageHref(page + 1)}>
                  Next →
                </Link>
              )}
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
