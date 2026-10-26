"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryOption } from "@/lib/products";

export type AdminProduct = {
  id?: string;
  slug: string;
  title: string;
  categorySlug: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  short: string;
  description: string[];
  specs: [string, string][];
  stock: number;
  isActive: boolean;
  imagePath: string | null;
};

const EMPTY: AdminProduct = {
  slug: "",
  title: "",
  categorySlug: "",
  price: 0,
  compareAtPrice: null,
  badge: null,
  short: "",
  description: [],
  specs: [],
  stock: 0,
  isActive: true,
  imagePath: null
};

export default function ProductForm({
  categories,
  initial
}: {
  categories: CategoryOption[];
  initial?: AdminProduct;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct>(initial ?? EMPTY);
  const [description, setDescription] = useState((initial?.description ?? []).join("\n\n"));
  const [specs, setSpecs] = useState(
    (initial?.specs ?? []).map(([name, value]) => `${name}: ${value}`).join("\n")
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) =>
    setProduct(prev => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let imagePath = product.imagePath;
      if (file) {
        const uploadBody = new FormData();
        uploadBody.append("file", file);
        const upload = await fetch("/api/admin/products/image", {
          method: "POST",
          body: uploadBody
        });
        const uploaded = (await upload.json().catch(() => ({}))) as {
          path?: string;
          error?: string;
        };
        if (!upload.ok || !uploaded.path) {
          setError(uploaded.error ?? "The image could not be uploaded.");
          setBusy(false);
          return;
        }
        imagePath = uploaded.path;
      }

      const payload = {
        id: product.id,
        slug: product.slug,
        title: product.title,
        categorySlug: product.categorySlug,
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice == null ? null : Number(product.compareAtPrice),
        badge: product.badge,
        short: product.short,
        description: description.split("\n").map(line => line.trim()).filter(Boolean),
        specs: specs
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [name, ...rest] = line.split(":");
            return [name.trim(), rest.join(":").trim()] as [string, string];
          })
          .filter(([name]) => name.length > 0),
        stock: Number(product.stock),
        isActive: product.isActive,
        imagePath
      };

      const response = await fetch("/api/admin/products", {
        method: product.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "The product could not be saved.");
        setBusy(false);
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="field-row">
        <label className="field">
          Title
          <input
            type="text"
            required
            maxLength={180}
            value={product.title}
            onChange={e => set("title", e.target.value)}
          />
        </label>
        <label className="field">
          Slug
          <input
            type="text"
            placeholder="auto-generated from the title"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={product.slug}
            onChange={e => set("slug", e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          Category
          <select
            required
            value={product.categorySlug}
            onChange={e => set("categorySlug", e.target.value)}
          >
            <option value="">Choose a category</option>
            {categories.map(category => (
              <option key={category.key} value={category.key}>{category.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Badge (optional)
          <input
            type="text"
            maxLength={24}
            placeholder="-10%"
            value={product.badge ?? ""}
            onChange={e => set("badge", e.target.value || null)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          Price (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={product.price}
            onChange={e => set("price", Number(e.target.value))}
          />
        </label>
        <label className="field">
          Compare-at price (optional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={product.compareAtPrice ?? ""}
            onChange={e => set("compareAtPrice", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          Stock on hand
          <input
            type="number"
            min="0"
            step="1"
            required
            value={product.stock}
            onChange={e => set("stock", Number(e.target.value))}
          />
        </label>
        <label className="field">
          Visibility
          <select
            value={product.isActive ? "active" : "hidden"}
            onChange={e => set("isActive", e.target.value === "active")}
          >
            <option value="active">Active — visible in the shop</option>
            <option value="hidden">Hidden — not purchasable</option>
          </select>
        </label>
      </div>

      <label className="field">
        Short summary
        <input
          type="text"
          maxLength={300}
          value={product.short}
          onChange={e => set("short", e.target.value)}
        />
      </label>

      <label className="field">
        Description <small>(one paragraph per line)</small>
        <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} />
      </label>

      <label className="field">
        Specifications <small>(one per line, “Name: Value”)</small>
        <textarea rows={6} value={specs} onChange={e => setSpecs(e.target.value)} />
      </label>

      <div className="field-row">
        <label className="field">
          Product image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="field">
          …or image path / URL
          <input
            type="text"
            placeholder="/images/product.webp or https://…"
            value={product.imagePath ?? ""}
            onChange={e => set("imagePath", e.target.value || null)}
          />
        </label>
      </div>

      {product.imagePath && (
        <p className="muted-note">
          Current image: <code>{product.imagePath}</code>
          {file ? " (a new file will replace it)" : ""}
        </p>
      )}

      {error && <p className="checkout-error" role="alert">{error}</p>}

      <div className="admin-form-actions">
        <button type="submit" className="btn-dark" disabled={busy}>
          {busy ? "Saving…" : product.id ? "Save changes" : "Create product"}
        </button>
        <button type="button" className="btn-outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
