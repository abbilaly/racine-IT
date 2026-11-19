"use client";

import Link from "next/link";
import { imageUrl, type Product } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

export default function MiniProduct({ product }: { product: Product }) {
  const { money } = useShop();

  return (
    <div className="mini-product">
      <Link href={`/product/${product.slug}`} className="mini-image">
        <img src={imageUrl(product.image)} alt={product.title} loading="lazy" />
      </Link>
      <div>
        <Link href={`/product/${product.slug}`}>{product.title}</Link>
        <div className="mini-rating" aria-label={`${product.rating} out of 5 stars`}>★★★★★</div>
        <p>
          {product.oldPrice && <del>{money(product.oldPrice)}</del>}{" "}
          <strong>{money(product.price)}</strong>
        </p>
      </div>
    </div>
  );
}
