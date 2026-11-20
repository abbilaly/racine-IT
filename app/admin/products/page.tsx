import Image from "next/image";
import Link from "next/link";
import { Package, Pencil, Plus } from "lucide-react";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { formatCents, listBrands, listCategories, listProducts } from "@/lib/server/admin-data";
import { getStoreCurrency } from "@/lib/server/store-currency";
import { Button } from "@/components/admin/ui/button";
import { ColumnToggle } from "@/components/admin/tables/column-toggle";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TablePagination } from "@/components/admin/tables/pagination";
import { SortHeader } from "@/components/admin/tables/sort-header";
import { StatusBadge } from "@/components/admin/tables/status-badge";
import {
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

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    status?: string;
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

  const [categories, brands, { rows: products, total }] = await Promise.all([
    listCategories(db),
    listBrands(db, { page: 1, limit: 200 }),
    listProducts(db, {
      q: params.q,
      category: params.category,
      brand: params.brand,
      status: params.status as "active" | "hidden" | "all" | undefined,
      page,
      limit,
      sort: params.sort,
      dir: params.dir
    })
  ]);

  const totalPages = Math.ceil(total / limit);
  const tableParams = {
    q: params.q,
    category: params.category,
    brand: params.brand,
    status: params.status,
    sort: params.sort,
    dir: params.dir
  };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Products"
        subtitle={`${total.toLocaleString()} product${total !== 1 ? "s" : ""} in the catalogue`}
        actions={
          <>
            <ColumnToggle
              tableId="products"
              columns={[
                { id: "brand", label: "Brand" },
                { id: "category", label: "Category" }
              ]}
            />
            <Button asChild size="sm">
              <Link href="/admin/products/new">
                <Plus size={15} aria-hidden="true" />
                Add product
              </Link>
            </Button>
          </>
        }
      />

      <TableCard>
        <TableToolbar
          action="/admin/products"
          q={params.q}
          placeholder="Search products…"
          hidden={{ sort: params.sort, dir: params.dir }}
        >
          <FilterField label="Category">
            <SelectInput name="category" defaultValue={params.category ?? ""}>
              <option value="">All categories</option>
              {categories.map(category => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="Brand">
            <SelectInput name="brand" defaultValue={params.brand ?? ""}>
              <option value="">All brands</option>
              {brands.rows.map(brand => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="Status">
            <SelectInput name="status" defaultValue={params.status ?? "all"}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </SelectInput>
          </FilterField>
        </TableToolbar>

        {products.length === 0 ? (
          <TableEmpty
            icon={<Package size={20} aria-hidden="true" />}
            title="No products found"
            description="Add your first product or change the filters above."
            action={
              <Button asChild size="sm">
                <Link href="/admin/products/new">Add product</Link>
              </Button>
            }
          />
        ) : (
          <TableScroll>
            <Table label="Products" tableId="products" minWidth="min-w-[760px]">
              <THead>
                <Th className="w-14">Image</Th>
                <SortHeader label="Product" column="title" base="/admin/products" params={tableParams} />
                <Th col="category" className="hidden lg:table-cell">Category</Th>
                <Th col="brand" className="hidden md:table-cell">Brand</Th>
                <SortHeader label="Price" column="price" base="/admin/products" params={tableParams} className="text-right" />
                <Th className="text-right">Stock</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </THead>
              <TBody>
                {products.map(product => (
                  <Tr key={product.id}>
                    <Td>
                      {product.images.length > 0 ? (
                        <span className="block size-9 overflow-hidden rounded-md border border-border bg-muted">
                          <Image
                            src={product.images[0].path}
                            alt=""
                            width={36}
                            height={36}
                            className="size-9 object-cover"
                          />
                        </span>
                      ) : (
                        <span className="grid size-9 place-items-center rounded-md border border-border bg-muted text-muted-foreground">
                          <Package size={15} aria-hidden="true" />
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="block max-w-[280px] truncate font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        title={product.title}
                      >
                        {product.title}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        /{product.slug}
                      </span>
                    </Td>
                    <Td col="category" className="hidden lg:table-cell">
                      {product.category ? (
                        <Link
                          href={`/admin/products?category=${product.category.slug}`}
                          className="text-[12px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {product.category.label}
                        </Link>
                      ) : (
                        <TdMuted>—</TdMuted>
                      )}
                    </Td>
                    <Td col="brand" className="hidden md:table-cell">
                      {product.brand ? (
                        <Link
                          href={`/admin/products?brand=${product.brand.slug}`}
                          className="text-[12px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {product.brand.name}
                        </Link>
                      ) : (
                        <TdMuted>—</TdMuted>
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCents(product.price_cents, currency)}
                      </span>
                      {product.compare_at_price_cents != null && (
                        <span className="ml-1 text-[11px] tabular-nums text-muted-foreground line-through">
                          {formatCents(product.compare_at_price_cents, currency)}
                        </span>
                      )}
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
                      <StatusBadge status={product.is_active ? "active" : "hidden"} />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <Link href={`/admin/products/${product.id}/edit`} aria-label={`Edit ${product.title}`}>
                            <Pencil size={13} aria-hidden="true" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <Link href={`/admin/products/${product.id}/stock`} aria-label={`Stock for ${product.title}`}>
                            <Package size={14} aria-hidden="true" />
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
          base="/admin/products"
          params={tableParams}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          label="products"
        />
      </TableCard>
    </div>
  );
}
