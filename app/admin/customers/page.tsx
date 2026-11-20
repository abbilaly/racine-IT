import Link from "next/link";
import { Users } from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { formatCents, listCustomers } from "@/lib/server/admin-data";
import { getStoreCurrency } from "@/lib/server/store-currency";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TablePagination } from "@/components/admin/tables/pagination";
import { SortHeader } from "@/components/admin/tables/sort-header";
import { TableToolbar } from "@/components/admin/tables/toolbar";
import {
  Table,
  TableCard,
  TableScroll,
  TBody,
  Td,
  TdMuted,
  Th,
  THead,
  Tr
} from "@/components/admin/tables/table";
import { TableEmpty } from "@/components/admin/tables/table-empty";

export const dynamic = "force-dynamic";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(iso));
}

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: "asc" | "desc" }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const currency = await getStoreCurrency();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  const { rows: customers, total } = await listCustomers(db, {
    q: params.q,
    page,
    limit,
    sort: params.sort,
    dir: params.dir
  });

  const totalPages = Math.ceil(total / limit);
  const tableParams = { q: params.q, sort: params.sort, dir: params.dir };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Customers"
        subtitle={`${total.toLocaleString()} customer${total !== 1 ? "s" : ""} · aggregated from stored orders`}
      />

      <TableCard>
        <TableToolbar
          action="/admin/customers"
          q={params.q}
          placeholder="Search by name or email…"
          hidden={{ sort: params.sort, dir: params.dir }}
        />

        {customers.length === 0 ? (
          <TableEmpty
            icon={<Users size={20} aria-hidden="true" />}
            title="No customers found"
            description="Customers appear here once orders are placed. Try a different search."
          />
        ) : (
          <TableScroll>
            <Table label="Customers" tableId="customers">
              <THead>
                <SortHeader label="Customer" column="name" base="/admin/customers" params={tableParams} />
                <Th className="hidden md:table-cell">Location</Th>
                <SortHeader label="Orders" column="orders" base="/admin/customers" params={tableParams} className="text-right" />
                <SortHeader label="Total spent" column="spent" base="/admin/customers" params={tableParams} className="text-right" />
                <SortHeader label="Last order" column="last" base="/admin/customers" params={tableParams} className="hidden sm:table-cell" />
                <Th className="text-right">History</Th>
              </THead>
              <TBody>
                {customers.map(customer => (
                  <Tr key={customer.email}>
                    <Td>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                        className="block truncate font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {customer.name || customer.email}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {customer.email}
                      </span>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <TdMuted>
                        {[customer.city, customer.country].filter(Boolean).join(", ") || "—"}
                      </TdMuted>
                    </Td>
                    <Td className="text-right tabular-nums">{customer.order_count}</Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatCents(customer.total_spent_cents, currency)}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-[12px] tabular-nums sm:table-cell">
                      <TdMuted>{shortDate(customer.last_order_at)}</TdMuted>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                        className="text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        View
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}

        <TablePagination
          base="/admin/customers"
          params={tableParams}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          label="customers"
        />
      </TableCard>
    </div>
  );
}
