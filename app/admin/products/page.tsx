import Link from "next/link";
import { Plus } from "lucide-react";
import DeleteProductButton from "@/components/admin/DeleteProductButton";
import { formatPrice } from "@/lib/products";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  is_active: boolean;
  product_images: { path: string }[];
  inventory: { on_hand: number; variant_id: string | null }[];
};

export default async function AdminProductsPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  const { data, error } = await db
    .from("products")
    .select(
      "id,slug,title,price_cents,is_active,product_images(path,kind),inventory(on_hand,variant_id)"
    )
    .order("title");

  const rows = ((data ?? []) as unknown as Row[]) ?? [];

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Products</h1>
          <p>{error ? "Could not load products" : `${rows.length} products in the catalogue`}</p>
        </div>
        <Link href="/admin/products/new" className="btn-dark">
          <Plus size={14} /> Add product
        </Link>
      </div>

      {error ? (
        <div className="empty-state">
          <h2>The database could not be reached</h2>
          <p>{error.message}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h2>No products yet</h2>
          <p>Run supabase/seed.sql, or add your first product.</p>
          <Link href="/admin/products/new" className="btn-dark">Add product</Link>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const stock = row.inventory
                .filter(line => line.variant_id === null)
                .reduce((sum, line) => sum + line.on_hand, 0);
              const image = row.product_images.find(img => img.path)?.path ?? "";
              return (
                <tr key={row.id}>
                  <td>
                    <div className="admin-product-cell">
                      {image ? <img src={image} alt="" width={40} height={40} /> : <span className="admin-no-image" />}
                      <span>
                        <strong>{row.title}</strong>
                        <small>/product/{row.slug}</small>
                      </span>
                    </div>
                  </td>
                  <td>{formatPrice(row.price_cents / 100)}</td>
                  <td className={stock <= 5 ? "admin-warn" : ""}>{stock}</td>
                  <td>
                    <span className={`admin-status is-${row.is_active ? "active" : "hidden"}`}>
                      {row.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="admin-row-actions">
                    <Link href={`/admin/products/${row.id}`} className="admin-icon-btn">Edit</Link>
                    <DeleteProductButton id={row.id} title={row.title} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
