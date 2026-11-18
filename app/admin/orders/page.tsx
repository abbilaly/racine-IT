import Link from "next/link";
import { Eye, Package, Pencil } from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { formatCents, listOrders } from "@/lib/server/admin-data";
import { Button } from "@/components/admin/ui/button";
import { ColumnToggle } from "@/components/admin/tables/column-toggle";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TablePagination } from "@/components/admin/tables/pagination";
import { SortHeader } from "@/components/admin/tables/sort-header";
import { StatusBadge } from "@/components/admin/tables/status-badge";
import {
  DateInput,
  FilterField,
  SelectInput,
  TableToolbar
} from "@/components/admin/tables/toolbar";
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

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
];

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(iso));
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    sort?: string;
    dir?: "asc" | "desc";
  }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  const { rows: orders, total } = await listOrders(db, {
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
    page,
    limit,
    sort: params.sort,
    dir: params.dir
  });

  const totalPages = Math.ceil(total / limit);
  const tableParams = {
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
    sort: params.sort,
    dir: params.dir
  };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Orders"
        subtitle={`${total.toLocaleString()} order${total !== 1 ? "s" : ""} · checkout orders with fulfilment status`}
        actions={
          <ColumnToggle
            tableId="orders"
            columns={[
              { id: "email", label: "Email" },
              { id: "items", label: "Items" },
              { id: "created", label: "Created" }
            ]}
          />
        }
      />

      <TableCard>
        <TableToolbar
          action="/admin/orders"
          q={params.q}
          placeholder="Search reference, name or email…"
          hidden={{ sort: params.sort, dir: params.dir }}
          resultLabel={total ? `${total.toLocaleString()} orders` : undefined}
        >
          <FilterField label="Status">
            <SelectInput name="status" defaultValue={params.status ?? "all"}>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="From">
            <DateInput name="from" defaultValue={params.from ?? ""} />
          </FilterField>
          <FilterField label="To">
            <DateInput name="to" defaultValue={params.to ?? ""} />
          </FilterField>
        </TableToolbar>

        {orders.length === 0 ? (
          <TableEmpty
            icon={<Package size={20} aria-hidden="true" />}
            title="No orders found"
            description="Orders appear here once customers complete checkout. Adjust the filters to widen the search."
          />
        ) : (
          <TableScroll>
            <Table label="Orders" tableId="orders">
              <THead>
                <SortHeader label="Reference" column="ref" base="/admin/orders" params={tableParams} />
                <Th>Customer</Th>
                <Th col="email" className="hidden md:table-cell">Email</Th>
                <Th col="items" className="hidden sm:table-cell">Items</Th>
                <SortHeader label="Total" column="total" base="/admin/orders" params={tableParams} className="text-right" />
                <SortHeader label="Status" column="status" base="/admin/orders" params={tableParams} />
                <SortHeader label="Created" column="created" base="/admin/orders" params={tableParams} className="hidden lg:table-cell" />
                <Th className="text-right">Actions</Th>
              </THead>
              <TBody>
                {orders.map(order => (
                  <Tr key={order.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {order.ref}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block truncate font-medium text-foreground">
                        {order.first_name} {order.last_name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground md:hidden">
                        {order.email}
                      </span>
                    </Td>
                    <Td col="email" className="hidden max-w-[200px] truncate md:table-cell">
                      <TdMuted>{order.email}</TdMuted>
                    </Td>
                    <Td col="items" className="hidden tabular-nums sm:table-cell">
                      {order.item_count}
                    </Td>
                    <Td className="text-right font-medium tabular-nums">{formatCents(order.total)}</Td>
                    <Td>
                      <StatusBadge status={order.status} />
                    </Td>
                    <Td col="created" className="hidden whitespace-nowrap text-[12px] tabular-nums lg:table-cell">
                      <TdMuted>{shortDate(order.created_at)}</TdMuted>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <Link href={`/admin/orders/${order.id}`} aria-label={`View ${order.ref}`}>
                            <Eye size={14} aria-hidden="true" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <Link href={`/admin/orders/${order.id}/status`} aria-label={`Update status for ${order.ref}`}>
                            <Pencil size={13} aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}

        <TablePagination
          base="/admin/orders"
          params={tableParams}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          label="orders"
        />
      </TableCard>
    </div>
  );
}
