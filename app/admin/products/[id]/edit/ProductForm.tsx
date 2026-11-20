"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";

interface ProductFormProps {
  productId: string;
  initial: {
    title: string;
    slug: string;
    categoryId?: string | null;
    categoryLabel?: string | null;
    brandId?: string | null;
    shortDescription: string;
    description: string[];
    priceCents: number;
    compareAtPriceCents: number | null;
    badge: string | null;
    origin: string | null;
    sourceUrl: string | null;
    is_active: boolean;
    is_featured: boolean;
  };
  categories: Array<{ id: string; slug: string; label: string; parent_id?: string | null }>;
  brands: Array<{ id: string; name: string; slug: string }>;
  /** ISO currency code shown beside the price fields. */
  currency: string;
}

/**
 * Orders categories parent-first and indents subcategories, so the product
 * editor can file a product onto either. Orphans are still listed.
 */
function orderedCategories<T extends { id: string; label: string; parent_id?: string | null }>(
  categories: T[]
): Array<{ category: T; depth: number }> {
  const out: Array<{ category: T; depth: number }> = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const category of categories) {
      if ((category.parent_id ?? null) !== parentId || seen.has(category.id)) continue;
      seen.add(category.id);
      out.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const category of categories) {
    if (!seen.has(category.id)) out.push({ category, depth: 0 });
  }
  return out;
}

export function ProductForm({ productId, initial, categories, brands, currency }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugsCheck, setSlugsCheck] = useState<Record<string, { checking: boolean; taken: boolean; error?: string }>>({});

  const checkSlug = useCallback(
    async (slug: string) => {
      if (!slug) {
        setSlugsCheck((prev) => ({ ...prev, slug: { checking: false, taken: false } }));
        return;
      }
      setSlugsCheck((prev) => ({ ...prev, slug: { checking: true, taken: false } }));
      try {
        const res = await fetch(`/api/admin/products/slug?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(productId)}`);
        const data = await res.json();
        setSlugsCheck((prev) => ({
          ...prev,
          slug: { checking: false, taken: data.taken, error: data.error },
        }));
      } catch {
        setSlugsCheck((prev) => ({
          ...prev,
          slug: { checking: false, taken: false, error: "Could not check slug." },
        }));
      }
    },
    [productId]
  );

  useEffect(() => {
    const debounce = setTimeout(() => {
      checkSlug(form.slug);
    }, 300);
    return () => clearTimeout(debounce);
  }, [form.slug, checkSlug]);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "slug") {
      checkSlug(value as string);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const creating = !productId;
      const res = await fetch(creating ? "/api/admin/products" : `/api/admin/products/${productId}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not save product.");
        return;
      }

      setSaved(true);
      if (creating && data.id) {
        router.push(`/admin/products/${data.id}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const slugStatus = slugsCheck.slug ?? { checking: false, taken: false };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <div className="admin-form-section">
        <h3 className="admin-form-section-title">Basic information</h3>

        <div className="admin-field">
          <label htmlFor="product-title" className="admin-label">
            Title <span className="admin-label-required">*</span>
          </label>
          <input
            id="product-title"
            type="text"
            className="admin-input"
            value={form.title}
            onChange={update("title")}
            required
            maxLength={180}
            placeholder="Product title"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="product-slug" className="admin-label">
            Slug <span className="admin-label-required">*</span>
          </label>
          <div className="admin-input-wrap">
            <span className="admin-input-prefix">/product/</span>
            <input
              id="product-slug"
              type="text"
              className="admin-input admin-input-suffix"
              value={form.slug}
              onChange={update("slug")}
              required
              maxLength={120}
              placeholder="product-slug"
            />
          </div>
          {slugStatus.checking && (
            <p className="admin-assistive-text">Checking slug availability…</p>
          )}
          {slugStatus.taken && (
            <p className="admin-assistive-text admin-assistive-text--error">
              <X size={14} />
              A product with this slug already exists.
            </p>
          )}
          {slugStatus.error && (
            <p className="admin-assistive-text admin-assistive-text--error">
              <AlertCircle size={14} />
              {slugStatus.error}
            </p>
          )}
        </div>

        <div className="admin-field">
          <label htmlFor="product-category" className="admin-label">
            Category <span className="admin-label-required">*</span>
          </label>
          <select
            id="product-category"
            className="admin-select"
            value={form.categoryId ?? ""}
            onChange={update("categoryId")}
            required
          >
            <option value="">Select a category…</option>
            {orderedCategories(categories).map(({ category, depth }) => (
              <option key={category.id} value={category.id}>
                {depth > 0 ? `${"— ".repeat(depth)}` : ""}
                {category.label}
              </option>
            ))}
          </select>
          {form.categoryLabel && (
            <p className="admin-assistive-text">
              Currently in <strong>{form.categoryLabel}</strong>
            </p>
          )}
        </div>

        <div className="admin-field">
          <label htmlFor="product-brand" className="admin-label">
            Brand
          </label>
          <select
            id="product-brand"
            className="admin-select"
            value={form.brandId ?? ""}
            onChange={update("brandId")}
          >
            <option value="">No brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          {brands.length === 0 && (
            <p className="admin-assistive-text">Create brands first under Admin → Brands.</p>
          )}
        </div>

        <div className="admin-field">
          <label htmlFor="product-short-description" className="admin-label">
            Short description <span className="admin-label-required">*</span>
          </label>
          <textarea
            id="product-short-description"
            className="admin-textarea"
            rows={3}
            value={form.shortDescription}
            onChange={update("shortDescription")}
            required
            maxLength={500}
            placeholder="A short summary shown in product cards"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="product-description" className="admin-label">
            Description
          </label>
          <textarea
            id="product-description"
            className="admin-textarea admin-textarea--large"
            rows={6}
            value={form.description.join("\n")}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                description: e.target.value.split("\n").filter((line) => line.trim() !== ""),
              }))
            }
            placeholder="Product description (one point per line)"
          />
        </div>
      </div>

      <div className="admin-form-section">
        <h3 className="admin-form-section-title">Pricing</h3>

        <div className="admin-field">
          <label htmlFor="product-price" className="admin-label">
            Price <span className="admin-label-required">*</span>
          </label>
          <div className="admin-input-wrap admin-input-wrap--currency">
            <span className="admin-input-prefix">{currency}</span>
            <input
              id="product-price"
              type="number"
              className="admin-input"
              value={form.priceCents / 100}
              onChange={(e) => setForm((prev) => ({ ...prev, priceCents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
              required
              min={0}
              max={999999.99}
              step={0.01}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="product-compare-at-price" className="admin-label">
            Compare-at price
          </label>
          <div className="admin-input-wrap admin-input-wrap--currency">
            <span className="admin-input-prefix">{currency}</span>
            <input
              id="product-compare-at-price"
              type="number"
              className="admin-input"
              value={form.compareAtPriceCents != null ? form.compareAtPriceCents / 100 : ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  compareAtPriceCents: e.target.value === "" ? null : Math.round(parseFloat(e.target.value || "0") * 100),
                }))
              }
              min={0}
              max={999999.99}
              step={0.01}
              placeholder="0.00"
            />
          </div>
          <p className="admin-assistive-text">
            Shows a strikethrough price on the storefront when filled.
          </p>
        </div>

        <div className="admin-field">
          <label htmlFor="product-badge" className="admin-label">
            Badge
          </label>
          <select
            id="product-badge"
            className="admin-select"
            value={form.badge ?? ""}
            onChange={update("badge")}
          >
            <option value="">No badge</option>
            <option value="New">New</option>
            <option value="Sale">Sale</option>
            <option value="Low stock">Low stock</option>
            <option value="Best seller">Best seller</option>
            <option value="Limited">Limited</option>
          </select>
        </div>
      </div>

      <div className="admin-form-section">
        <h3 className="admin-form-section-title">Catalogue provenance</h3>
        <p className="admin-assistive-text">
          Both fields are optional and are only shown when recorded. Leave the origin empty
          unless the supplier or manufacturer documents it — never infer it from the brand.
        </p>

        <div className="admin-field">
          <label htmlFor="product-origin" className="admin-label">
            Country of origin
          </label>
          <input
            id="product-origin"
            type="text"
            className="admin-input"
            value={form.origin ?? ""}
            onChange={update("origin")}
            maxLength={80}
            placeholder="Documented country of origin"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="product-source-url" className="admin-label">
            Source URL
          </label>
          <input
            id="product-source-url"
            type="url"
            className="admin-input"
            value={form.sourceUrl ?? ""}
            onChange={update("sourceUrl")}
            maxLength={500}
            placeholder="https://supplier.example/products/sku"
          />
          <p className="admin-assistive-text">
            The supplier or manufacturer page this product&rsquo;s data was verified against.
          </p>
        </div>
      </div>

      <div className="admin-form-section">
        <h3 className="admin-form-section-title">Availability</h3>

        <div className="admin-form-row admin-form-row--inline">
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={update("is_active")}
            />
            <span>Active</span>
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={update("is_featured")}
            />
            <span>Featured</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="admin-form-success" role="status">
          <Check size={16} />
          Product saved.
        </div>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Save product"}
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={saving}
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
