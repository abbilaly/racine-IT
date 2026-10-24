import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";
import { categoryLabel, getProduct, products } from "@/lib/products";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product not found — Racine IT" };
  return {
    title: `${product.title} — Racine IT`,
    description: product.short
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const sameCategory = products.filter(
    p => p.category === product.category && p.slug !== product.slug
  );
  const related = [...sameCategory, ...products.filter(p => p.category !== product.category)]
    .slice(0, 5);

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span>
        <Link href="/shop">Shop</Link> <span>/</span>
        <Link href={`/shop?category=${product.category}`}>{categoryLabel(product.category)}</Link>{" "}
        <span>/</span> <span aria-current="page">{product.title}</span>
      </nav>

      <ProductDetail product={product} />

      <section className="pd-body">
        <div className="pd-description">
          <h2>Description</h2>
          {product.description.map(paragraph => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
        <div className="pd-specs">
          <h2>Specifications</h2>
          <dl>
            {product.specs.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section related-section">
        <div className="title-line">
          <h2>You may also like</h2>
          <Link href={`/shop?category=${product.category}`}>View All ›</Link>
        </div>
        <div className="deal-grid">
          {related.map(p => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
