"use client";

import Link from "next/link";
import { GitCompareArrows, Heart, ShoppingCart } from "lucide-react";
import { formatPrice, imageUrl, type Product } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, toggleCompare, inWishlist, inCompare } = useShop();
  const wished = inWishlist(product.slug);
  const compared = inCompare(product.slug);

  return (
    <article className="product-card">
      <div className="product-media">
        {product.badge && <span className="sale-badge">{product.badge}</span>}
        <div className="hover-actions">
          <button
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wished}
            className={wished ? "is-on" : ""}
            onClick={() => toggleWishlist(product.slug)}
          >
            <Heart size={17} fill={wished ? "currentColor" : "none"} />
          </button>
          <button
            aria-label={compared ? "Remove from compare" : "Add to compare"}
            aria-pressed={compared}
            className={compared ? "is-on" : ""}
            onClick={() => toggleCompare(product.slug)}
          >
            <GitCompareArrows size={17} />
          </button>
        </div>
        <Link href={`/product/${product.slug}`} className="product-primary-link">
          <img className="product-primary" src={imageUrl(product.image)} alt={product.title} loading="lazy" />
          <img className="product-secondary" src={imageUrl(product.hover)} alt="" loading="lazy" />
        </Link>
        <button className="quick-add" onClick={() => addToCart(product.slug)}>
          <ShoppingCart size={13} /> Add to Cart
        </button>
      </div>
      <div className="product-copy">
        <Link href={`/product/${product.slug}`}>{product.title}</Link>
        <div className="rating" aria-label={`${product.rating} out of 5 stars, ${product.reviews} reviews`}>
          ★★★★★ <small>({product.reviews})</small>
        </div>
        <div className="price-line">
          {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          <strong>{formatPrice(product.price)}</strong>
        </div>
      </div>
    </article>
  );
}
