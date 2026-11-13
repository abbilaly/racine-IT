import { requireAdmin, adminClient } from "@/lib/server/admin-auth";
import { listProducts, listCategories, listBrands, formatCents } from "@/lib/server/admin-data";
import { AdminPager, AdminEmptyState, AdminBadgeStatus } from "@/lib/server/admin-ui";
import Link from "next/link";
import { Plus, Package, Search, Filter, ArrowUpDown, MoreHorizontal, Edit2 } from "lucide-react";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; brand?: string; status?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const db = adminClient(session);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const categories = await listCategories(db);
  const brands = await listBrands(db, { page: 1, limit: 200 });

  const { rows: products, total } = await listProducts(db, {
    q: params.q,
    category: params.category,
    brand: params.brand,
    status: params.status as "active" | "hidden" | "all" | undefined,
    page,
    limit,
  });

  const totalPages = Math.ceil(total / limit);
  const categoryLabel = categories.find((c) => c.slug === params.category)?.label;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Products</h1>
          <p className="admin-page-subtitle">{total.toLocaleString()} product{total !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/products/new" className="btn-dark">
          <Plus size={16} />
          Add product
        </Link>
      </div>

      <form className="admin-toolbar" method="get" action="/admin/products">
        <div className="admin-search">
          <Search size={16} className="admin-icon" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search products…"
            className="admin-search-input"
          />
        </div>

        <div className="admin-filters">
          <label className="admin-filter">
            <Filter size={14} />
            <span>Category</span>
            <select name="category" defaultValue={params.category ?? ""} className="admin-select">
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-filter">
            <span>Brand</span>
            <select name="brand" defaultValue={params.brand ?? ""} className="admin-select">
              <option value="">All brands</option>
              {brands.rows.map((brand) => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-filter">
            <span>Status</span>
            <select name="status" defaultValue={params.status ?? "all"} className="admin-select">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>

          <input type="hidden" name="page" value="1" />
          <button className="btn-outline" type="submit">
            Apply filters
          </button>
          <a href="/admin/products" className="btn-outline">
            Clear
          </a>
        </div>
      </form>

      {products.length === 0 ? (
        <AdminEmptyState
          icon={<Package size={32} />}
          title="No products found"
          description="Add your first product or change the filters above."
        />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Product</th>
                <th scope="col">Category</th>
                <th scope="col">Brand</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.images.length > 0 ? (
                      <div className="admin-product-thumb">
                        <Image
                          src={product.images[0].path}
                          alt={product.title}
                          width={48}
                          height={48}
                          className="admin-image"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div className="admin-product-thumb admin-product-thumb--placeholder">
                        <Package size={20} />
                      </div>
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/products/${product.id}`} className="admin-product-link">
                      <span className="admin-product-title">{product.title}</span>
                      <span className="admin-product-slug">/{product.slug}</span>
                    </Link>
                  </td>
                  <td>
                    {product.category ? (
                      <Link href={`/admin/products?category=${product.category.slug}`} className="admin-link-muted">
                        {product.category.label}
                      </Link>
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                  <td>
                    {product.brand ? (
                      <Link href={`/admin/products?brand=${product.brand.slug}`} className="admin-link-muted">
                        {product.brand.name}
                      </Link>
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="admin-price">{formatCents(product.price_cents)}</span>
                    {product.compare_at_price_cents != null && (
                      <span className="admin-price-old">{formatCents(product.compare_at_price_cents)}</span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-stock ${product.stock === 0 ? "admin-stock--zero" : product.stock < 5 ? "admin-stock--low" : ""}`}>
                      {product.stock.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <AdminBadgeStatus status={product.is_active ? "active" : "hidden"} />
                  </td>
                  <td className="admin-table-actions">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="admin-action-btn"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}/stock`}
                      className="admin-action-btn"
                      title="Stock"
                    >
                      <Package size={14} />
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}/images`}
                      className="admin-action-btn"
                      title="Images"
                    >
                      <MoreHorizontal size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager
        page={page}
        totalPages={totalPages}
        totalItems={total}
        params={{
          q: params.q,
          category: params.category,
          brand: params.brand,
          status: params.status && params.status !== "all" ? params.status : undefined,
        }}
      />
    </div>
  );
}
