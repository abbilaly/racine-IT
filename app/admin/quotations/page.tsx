import Link from "next/link";
import { FileText } from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { formatCents, listQuotations } from "@/lib/server/admin-data";
import { getStoreCurrency } from "@/lib/server/store-currency";
import { QuotationCreateForm } from "@/components/admin/QuotationCreateForm";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TablePagination } from "@/components/admin/tables/pagination";
import { SortHeader } from "@/components/admin/tables/sort-header";
import { StatusBadge } from "@/components/admin/tables/status-badge";
import { FilterField, SelectInput, TableToolbar } from "@/components/admin/tables/toolbar";
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

const STATUSES = ["all", "draft", "sent", "accepted", "rejected", "expired"];

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(iso));
}

export default async function AdminQuotationsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: "asc" | "desc";
  }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const currency = await getStoreCurrency();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const status = params.status && params.status !== "all" ? params.status : undefined;

  const { rows: quotations, total } = await listQuotations(db, {
    status,
    q: params.q,
    page,
    limit,
    sort: params.sort,
    dir: params.dir
  });

  const totalPages = Math.ceil(total / limit);
  const tableParams = {
    status: params.status,
    q: params.q,
    sort: params.sort,
    dir: params.dir
  };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Quotations"
        subtitle={`${total.toLocaleString()} quotation${total !== 1 ? "s" : ""} · B2B requests kept separate from checkout orders`}
        actions={<QuotationCreateForm />}
      />

      <TableCard>
        <TableToolbar
          action="/admin/quotations"
          q={params.q}
          placeholder="Search reference, name or email…"
          hidden={{ sort: params.sort, dir: params.dir }}
        >
          <FilterField label="Status">
            <SelectInput name="status" defaultValue={params.status ?? "all"}>
              {STATUSES.map(value => (
                <option key={value} value={value}>
                  {value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </SelectInput>
          </FilterField>
        </TableToolbar>

        {quotations.length === 0 ? (
          <TableEmpty
            icon={<FileText size={20} aria-hidden="true" />}
            title="No quotations found"
            description="Create a quotation for a business customer buying in volume."
          />
        ) : (
          <TableScroll>
            <Table label="Quotations" tableId="quotations" minWidth="min-w-[760px]">
              <THead>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <SortHeader label="Status" column="status" base="/admin/quotations" params={tableParams} />
                <SortHeader label="Total" column="total" base="/admin/quotations" params={tableParams} className="text-right" />
                <SortHeader label="Valid until" column="valid" base="/admin/quotations" params={tableParams} className="hidden md:table-cell" />
                <Th className="hidden lg:table-cell">Order</Th>
                <SortHeader label="Created" column="created" base="/admin/quotations" params={tableParams} className="hidden sm:table-cell" />
              </THead>
              <TBody>
                {quotations.map(quotation => (
                  <Tr key={quotation.id}>
                    <Td>
                      <Link
                        href={`/admin/quotations/${quotation.id}`}
                        className="font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {quotation.ref}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block max-w-[220px] truncate font-medium text-foreground">
                        {quotation.customer_name}
                      </span>
                      <span className="block max-w-[220px] truncate text-[11px] text-muted-foreground">
                        {quotation.customer_company || quotation.customer_email}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={quotation.status} />
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatCents(quotation.total_cents, currency)}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-[12px] tabular-nums md:table-cell">
                      <TdMuted>{shortDate(quotation.valid_until)}</TdMuted>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {quotation.converted_order_id ? (
                        <Link
                          href={`/admin/orders/${quotation.converted_order_id}`}
                          className="text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          View order
                        </Link>
                      ) : (
                        <TdMuted>—</TdMuted>
                      )}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-[12px] tabular-nums sm:table-cell">
                      <TdMuted>{shortDate(quotation.created_at)}</TdMuted>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}

        <TablePagination
          base="/admin/quotations"
          params={tableParams}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          label="quotations"
        />
      </TableCard>
    </div>
  );
}
