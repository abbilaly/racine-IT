import { Package, Minus } from "lucide-react";
import { formatCents } from "@/lib/server/admin-data";
import { AdminBadgeStatus } from "@/lib/server/admin-ui";

interface OrderItemsProps {
  items: Array<{
    id: number;
    slug: string;
    title: string;
    variant_name: string | null;
    unit_price: number;
    qty: number;
    line_total: number;
    snapshot: Record<string, unknown> | null;
  }>;
  /** ISO currency code used to label unit prices and line totals. */
  currency: string;
}

export function OrderItems({ items, currency }: OrderItemsProps) {
  if (items.length === 0) {
    return (
      <div className="admin-empty">
        <Package size={24} />
        <p>No items in this order.</p>
      </div>
    );
  }

  return (
    <div className="admin-table-responsive">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Variant</th>
            <th scope="col" className="admin-table-center">Qty</th>
            <th scope="col" className="admin-table-right">Unit price</th>
            <th scope="col" className="admin-table-right">Line total</th>
            <th scope="col" className="admin-table-actions">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const unitPrice = item.unit_price;
            const lineTotal = item.line_total;
            const isDigital = (item.snapshot && (item.snapshot as any).digital) || item.slug.includes("digital");

            return (
              <tr key={item.id}>
                <td>
                  <span className="admin-product-title">{item.title}</span>
                  <span className="admin-product-slug">/{item.slug}</span>
                </td>
                <td>
                  {item.variant_name ? (
                    <span className="admin-variant">{item.variant_name}</span>
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
                <td className="admin-table-center">
                  <span className="admin-qty">
                    <Minus size={12} />
                    {item.qty}
                  </span>
                </td>
                <td className="admin-table-right">{formatCents(unitPrice, currency)}</td>
                <td className="admin-table-right">{formatCents(lineTotal, currency)}</td>
                <td className="admin-table-actions">
                  {isDigital ? (
                    <AdminBadgeStatus status="digital" />
                  ) : (
                    <AdminBadgeStatus status="physical" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
