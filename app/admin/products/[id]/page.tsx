import { notFound } from "next/navigation";
import ProductForm, { type AdminProduct } from "@/components/admin/ProductForm";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string[] | null;
  specs: { name: string; value: string }[] | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  badge: string | null;
  is_active: boolean;
  category: unknown;
  product_images: { path: string; kind: string }[];
  inventory: { on_hand: number; variant_id: string | null }[];
};

export default async function EditProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin();
  const db = adminClient(session);

  const [productRes, categoriesRes] = await Promise.all([
    db
      .from("products")
      .select(
        "id,slug,title,short_description,description,specs,price_cents,compare_at_price_cents,badge,is_active,category:categories(slug),product_images(path,kind),inventory(on_hand,variant_id)"
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("categories").select("slug,label").order("position")
  ]);

  if (productRes.error) {
    return (
      <div className="admin-page">
        <div className="empty-state">
          <h2>The product could not be loaded</h2>
          <p>{productRes.error.message}</p>
        </div>
      </div>
    );
  }
  if (!productRes.data) notFound();

  const row = productRes.data as unknown as Row;
  const relation = Array.isArray(row.category) ? row.category[0] : row.category;
  const primary = row.product_images.find(image => image.kind === "primary")?.path ?? null;
  const stock = row.inventory
    .filter(line => line.variant_id === null)
    .reduce((sum, line) => sum + line.on_hand, 0);

  const initial: AdminProduct = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categorySlug: (relation as { slug?: string } | null)?.slug ?? "",
    price: row.price_cents / 100,
    compareAtPrice: row.compare_at_price_cents == null ? null : row.compare_at_price_cents / 100,
    badge: row.badge,
    short: row.short_description,
    description: row.description ?? [],
    specs: (row.specs ?? []).map(spec => [spec.name, spec.value] as [string, string]),
    stock,
    isActive: row.is_active,
    imagePath: primary
  };

  const categories = (categoriesRes.data ?? []).map(c => ({ key: c.slug, label: c.label }));

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Edit product</h1>
          <p>{row.title}</p>
        </div>
      </div>
      <ProductForm categories={categories} initial={initial} />
    </div>
  );
}
