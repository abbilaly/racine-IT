import Link from "next/link";
import { AlertTriangle, History, Package, Upload } from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { listProducts, listStockAdjustments, lowStockProducts } from "@/lib/server/admin-data";
import { Button } from "@/components/admin/ui/button";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TablePagination } from "@/components/admin/tables/pagination";
import { SortHeader } from "@/components/admin/tables/sort-header";
import { StatusBadge } from "@/components/admin/tables/status-badge";
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

function stockStatus(stock: number): string {
  return stock === 0 ? "out of stock" : stock < 5 ? "low stock" : "in stock";
}

export default async function AdminInventoryPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: "asc" | "desc" }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  const [{ rows: products, total }, low, { rows: adjustments }] = await Promise.all([
    listProducts(db, { q: params.q, page, limit, sort: params.sort, dir: params.dir }),
    lowStockProducts(db, 5),
    listStockAdjustments(db, undefined, { page: 1, limit: 20 })
  ]);

  const totalPages = Math.ceil(total / limit);
  const tableParams = { q: params.q, sort: params.sort, dir: params.dir };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Inventory"
        subtitle={`${total.toLocaleString()} product${total !== 1 ? "s" : ""} tracked · low-stock threshold 5 units`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/products/import">
              <Upload size={14} aria-hidden="true" />
              Import stock
            </Link>
          </Button>
        }
      />

      {low.length > 0 && (
        <TableCard className="mb-4">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <AlertTriangle size={14} className="text-amber-500" aria-hidden="true" />
              Low stock alerts
            </h2>
            <span className="text-[11px] text-muted-foreground">5 units or fewer</span>
          </div>
          <ul className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2">
            {low.map(row => (
              <li
                key={row.id}
                className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 last:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <Link
                  href={`/admin/products/${row.id}/stock`}
                  className="min-w-0 flex-1 truncate text-[13px] text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  title={row.title}
                >
                  {row.title}
                </Link>
                <StatusBadge status={stockStatus(row.stock)} />
                <span className="w-10 text-right text-[12px] tabular-nums text-muted-foreground">
                  {row.stock}
                </span>
              </li>
            ))}
          </ul>
        </TableCard>
      )}

      <TableCard>
        <TableToolbar
          action="/admin/inventory"
          q={params.q}
          placeholder="Search products…"
          hidden={{ sort: params.sort, dir: params.dir }}
        />

        {products.length === 0 ? (
          <TableEmpty
            icon={<Package size={20} aria-hidden="true" />}
            title="No products found"
            description="Adjust the search or add products before tracking stock."
          />
        ) : (
          <TableScroll>
            <Table label="Stock levels" tableId="inventory" minWidth="min-w-[620px]">
              <THead>
                <SortHeader label="Product" column="title" base="/admin/inventory" params={tableParams} />
                <Th className="hidden md:table-cell">SKU</Th>
                <Th className="text-right">On hand</Th>
                <Th>Status</Th>
                <Th className="text-right">Adjust</Th>
              </THead>
              <TBody>
                {products.map(product => (
                  <Tr key={product.id}>
                    <Td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="block max-w-[320px] truncate font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        title={product.title}
                      >
                        {product.title}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground md:hidden">
                        /{product.slug}
                      </span>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <TdMuted>/{product.slug}</TdMuted>
                    </Td>
                    <Td className="text-right">
                      <span
                        className={`tabular-nums ${
                          product.stock === 0
                            ? "font-medium text-rose-600 dark:text-rose-400"
                            : product.stock < 5
                              ? "font-medium text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                        }`}
                      >
                        {product.stock.toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={stockStatus(product.stock)} />
                    </Td>
                    <Td className="text-right">
                      <Button asChild variant="ghost" size="icon" className="size-7">
                        <Link href={`/admin/products/${product.id}/stock`} aria-label={`Adjust stock for ${product.title}`}>
                          <History size={14} aria-hidden="true" />
                        </Link>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}

        <TablePagination
          base="/admin/inventory"
          params={tableParams}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          label="products"
        />
      </TableCard>

      <TableCard className="mt-4">
        <div className="border-b border-border px-4 py-3">
          <h2 className="m-0 text-[13px] font-semibold text-foreground">Recent stock movements</h2>
        </div>
        {adjustments.length === 0 ? (
          <TableEmpty
            icon={<History size={20} aria-hidden="true" />}
            title="No stock adjustments yet"
            description="Manual stock changes are recorded here with a reason."
          />
        ) : (
          <TableScroll>
            <Table label="Recent stock movements" minWidth="min-w-[560px]">
              <THead>
                <Th>Date</Th>
                <Th className="text-right">Change</Th>
                <Th>Reason</Th>
                <Th className="hidden sm:table-cell">Note</Th>
              </THead>
              <TBody>
                {adjustments.map(row => (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap text-[12px] tabular-nums">
                      <TdMuted>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC"
                        }).format(new Date(row.created_at))}
                      </TdMuted>
                    </Td>
                    <Td
                      className={`text-right font-medium tabular-nums ${
                        row.change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {row.change > 0 ? "+" : ""}
                      {row.change}
                    </Td>
                    <Td>{row.reason}</Td>
                    <Td className="hidden max-w-[260px] truncate sm:table-cell">
                      <TdMuted>{row.note || "—"}</TdMuted>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </TableCard>
    </div>
  );
}
