import Link from "next/link";
import { formatPrice, imageUrl, type Product } from "@/lib/products";

export default function MiniProduct({ product }: { product: Product }) {
  return (
    <div className="mini-product">
      <Link href={`/product/${product.slug}`} className="mini-image">
        <img src={imageUrl(product.image)} alt={product.title} loading="lazy" />
      </Link>
      <div>
        <Link href={`/product/${product.slug}`}>{product.title}</Link>
        <div className="mini-rating" aria-label={`${product.rating} out of 5 stars`}>★★★★★</div>
        <p>
          {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}{" "}
          <strong>{formatPrice(product.price)}</strong>
        </p>
      </div>
    </div>
  );
}
