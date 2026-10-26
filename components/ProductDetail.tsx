"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GitCompareArrows, Heart, Minus, Plus, ShoppingCart, Truck } from "lucide-react";
import { formatPrice, imageUrl, type Product } from "@/lib/products";
import { MAX_COMPARE, useShop } from "@/lib/shop-store";

export default function ProductDetail({ product }: { product: Product }) {
  const [main, setMain] = useState(product.image);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const { addToCart, toggleWishlist, toggleCompare, inWishlist, inCompare, compare, categoryLabel } =
    useShop();

  useEffect(() => {
    setMain(product.image);
    setQty(1);
  }, [product.slug, product.image]);

  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 1600);
    return () => window.clearTimeout(t);
  }, [added]);

  // mobile only (CSS hides the bar on desktop): show a fixed buy bar once the
  // inline add-to-cart row has scrolled out of view, so it never covers it.
  useEffect(() => {
    const node = buyRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting), {
      threshold: 0
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const wished = inWishlist(product.slug);
  const compared = inCompare(product.slug);
  const compareFull = !compared && compare.length >= MAX_COMPARE;
  const gallery = [product.image, product.hover];
  const saving = product.oldPrice ? product.oldPrice - product.price : 0;

  return (
    <div className="product-detail">
      <div className="pd-gallery">
        {product.badge && <span className="sale-badge">{product.badge}</span>}
        <img src={imageUrl(main)} alt={product.title} />
        <div className="pd-thumbs">
          {gallery.map(file => (
            <button
              key={file}
              className={main === file ? "is-on" : ""}
              onClick={() => setMain(file)}
              aria-label="Show image"
            >
              <img src={imageUrl(file)} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="pd-info">
        <Link href={`/shop?category=${product.category}`} className="pd-category">
          {categoryLabel(product.category)}
        </Link>
        <h1>{product.title}</h1>
        <div className="pd-rating">
          <span className="rating">★★★★★</span>
          <small>{product.rating}.0 · {product.reviews} reviews</small>
        </div>

        <div className="pd-price">
          {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          <strong>{formatPrice(product.price)}</strong>
          {saving > 0 && <em>Save {formatPrice(saving)}</em>}
        </div>

        <p className="pd-short">{product.short}</p>

        <p className={`pd-stock ${product.stock <= 5 ? "low" : ""}`}>
          {product.stock > 0
            ? product.stock <= 5
              ? `Only ${product.stock} left in stock`
              : "In stock, ready to ship"
            : "Out of stock"}
        </p>

        <div className="pd-buy" ref={buyRef}>
          <div className="qty-stepper">
            <button aria-label="Decrease quantity" onClick={() => setQty(v => Math.max(1, v - 1))}>
              <Minus size={14} />
            </button>
            <span aria-live="polite">{qty}</span>
            <button aria-label="Increase quantity" onClick={() => setQty(v => Math.min(product.stock, v + 1))}>
              <Plus size={14} />
            </button>
          </div>
          <button
            className="btn-dark pd-add"
            disabled={product.stock <= 0}
            onClick={() => {
              addToCart(product.slug, qty);
              setAdded(true);
            }}
          >
            <ShoppingCart size={15} /> {added ? "Added to cart" : "Add to Cart"}
          </button>
          <button
            className={`icon-btn ${wished ? "is-on" : ""}`}
            aria-pressed={wished}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            onClick={() => toggleWishlist(product.slug)}
          >
            <Heart size={18} fill={wished ? "currentColor" : "none"} />
          </button>
          <button
            className={`icon-btn ${compared ? "is-on" : ""}`}
            aria-pressed={compared}
            aria-label={compared ? "Remove from compare" : "Add to compare"}
            disabled={compareFull}
            title={compareFull ? `Compare holds up to ${MAX_COMPARE} products` : undefined}
            onClick={() => toggleCompare(product.slug)}
          >
            <GitCompareArrows size={18} />
          </button>
        </div>

        <ul className="pd-perks">
          <li><Truck size={15} /> Free shipping on this item, customs and duties included</li>
          <li>Free returns within 15 days</li>
          <li>12-month warranty on every product</li>
        </ul>
      </div>

      {showBar && (
        <div className="mobile-buy-bar">
          <strong className="bar-price">
            {formatPrice(product.price)}
            <small> Qty {qty}</small>
          </strong>
          <button
            className="btn-dark pd-add"
            disabled={product.stock <= 0}
            onClick={() => {
              addToCart(product.slug, qty);
              setAdded(true);
            }}
          >
            <ShoppingCart size={15} /> {added ? "Added to cart" : "Add to Cart"}
          </button>
        </div>
      )}
    </div>
  );
}
