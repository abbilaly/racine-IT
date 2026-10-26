"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { imageUrl } from "@/lib/products";
import { MAX_COMPARE, useShop } from "@/lib/shop-store";

export default function CompareTray() {
  const { compare, hydrated, toggleCompare, clearCompare, getProduct } = useShop();
  if (!hydrated || compare.length === 0) return null;

  const items = compare.map(getProduct).filter(Boolean);

  return (
    <aside className="compare-tray" aria-label="Compare selection">
      <div className="site-shell tray-inner">
        <span className="tray-label">
          Compare <b>{items.length}</b><small>/{MAX_COMPARE} products</small>
        </span>
        <ul className="tray-items">
          {items.map(p => (
            <li key={p!.slug}>
              <img src={imageUrl(p!.image)} alt="" width={40} height={40} />
              <span>{p!.title}</span>
              <button aria-label={`Remove ${p!.title} from compare`} onClick={() => toggleCompare(p!.slug)}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
        <div className="tray-actions">
          <button className="tray-clear" onClick={clearCompare}>Clear all</button>
          <Link href="/compare" className="tray-go">Compare now</Link>
        </div>
      </div>
    </aside>
  );
}
