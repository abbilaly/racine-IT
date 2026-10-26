"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useShop } from "@/lib/shop-store";

export default function WishlistGrid() {
  const { wishlist, hydrated, getProduct } = useShop();

  if (!hydrated) {
    return <p className="muted-note">Loading your saved items…</p>;
  }

  const items = wishlist.map(getProduct).filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your wishlist is empty</h2>
        <p>Tap the heart on any product to save it here for later.</p>
        <Link href="/shop" className="btn-dark">Browse products</Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <h1>Wishlist</h1>
        <p>{items.length} saved item{items.length === 1 ? "" : "s"}</p>
      </div>
      <div className="deal-grid shop-grid">
        {items.map(p => (
          <ProductCard key={p!.slug} product={p!} />
        ))}
      </div>
    </>
  );
}
