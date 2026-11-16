"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { AdminEmptyState, AdminSpinner } from "@/lib/server/admin-ui";

type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  logo_path: string | null;
  category_ids?: string[];
};

type CategoryOption = {
  id: string;
  label: string;
  parent_id: string | null;
  is_active: boolean;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  logoPath: string;
  position: number;
  categoryIds: string[];
};

const EMPTY: FormState = {
  name: "",
  slug: "",
  description: "",
  logoPath: "",
  position: 0,
  categoryIds: []
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Brand CRUD plus `brand_categories` associations (0008).
 *
 * Note: `public.brands` has no `is_active` column, so no visibility switch is
 * rendered — a brand is visible on the storefront exactly when products carry
 * it. Adding a brand-level flag needs an approved migration.
 */
export function BrandsManager({
  initial = [],
  categories
}: {
  initial?: Brand[];
  categories: CategoryOption[];
}) {
  const [rows, setRows] = useState<Brand[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/brands?page=1&limit=200&withCategories=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load brands.");
      setRows(data.brands ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load brands.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const orderedCategories = useMemo(() => {
    const tops = categories.filter(category => !category.parent_id);
    const out: Array<CategoryOption & { depth: number }> = [];
    for (const top of tops) {
      out.push({ ...top, depth: 0 });
      for (const child of categories.filter(category => category.parent_id === top.id)) {
        out.push({ ...child, depth: 1 });
      }
    }
    for (const category of categories) {
      if (!out.some(entry => entry.id === category.id)) out.push({ ...category, depth: 0 });
    }
    return out;
  }, [categories]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      brand => brand.name.toLowerCase().includes(q) || brand.slug.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, position: (rows?.at(-1)?.position ?? 0) + 1 });
    setError(null);
    setNotice(null);
  };

  const startEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? "",
      logoPath: brand.logo_path ?? "",
      position: brand.position,
      categoryIds: brand.category_ids ?? []
    });
    setError(null);
    setNotice(null);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/catalogue/images?kind=brand-logo", {
        method: "POST",
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The logo could not be uploaded.");
      setForm(prev => ({ ...prev, logoPath: data.path }));
      setNotice("Logo uploaded. Save the brand to apply it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The logo could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.name.trim()) return setError("Brand name is required.");
    if (form.name.trim().length > 120) return setError("Brand name must be at most 120 characters.");
    if (!SLUG_RE.test(form.slug.trim())) {
      return setError("Slug must be lowercase letters, digits and dashes.");
    }
    if (form.description.trim().length > 600) {
      return setError("Description must be at most 600 characters.");
    }
    if (!Number.isInteger(form.position) || form.position < 0 || form.position > 999) {
      return setError("Display order must be a whole number between 0 and 999.");
    }
    if (rows?.some(brand => brand.slug === form.slug.trim() && brand.id !== editing?.id)) {
      return setError("A brand with that slug already exists.");
    }

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description.trim() || null,
        logo_path: form.logoPath.trim() || null,
        position: form.position,
        categoryIds: form.categoryIds
      };
      const res = await fetch(
        editing ? `/api/admin/brands?id=${encodeURIComponent(editing.id)}` : "/api/admin/brands",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The brand could not be saved.");
      setNotice(editing ? "Brand updated." : "Brand created.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The brand could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (brand: Brand) => {
    if (
      !window.confirm(
        `Delete the brand “${brand.name}”? Products keep their other details, but the brand link is removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/brands?id=${encodeURIComponent(brand.id)}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The brand could not be deleted.");
      setNotice("Brand deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The brand could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter(id => id !== categoryId)
        : [...prev.categoryIds, categoryId]
    }));
  };

  if (rows === null) return <AdminSpinner />;

  return (
    <div className="admin-catalogue">
      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="admin-form-success" role="status">
          <span>{notice}</span>
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} className="admin-icon" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Search brands…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="admin-filters">
          <button type="button" className="btn-dark" onClick={startCreate} disabled={busy}>
            New brand
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="admin-form admin-card">
        <div className="admin-card-header">
          <h2>{editing ? `Edit “${editing.name}”` : "New brand"}</h2>
          {editing && (
            <button type="button" className="admin-card-link" onClick={resetForm}>
              <X size={14} /> Cancel edit
            </button>
          )}
        </div>

        <div className="admin-form-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="brand-name">
              Name <span className="admin-label-required">*</span>
            </label>
            <input
              id="brand-name"
              className="admin-input"
              required
              maxLength={120}
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="brand-slug">
              Slug <span className="admin-label-required">*</span>
            </label>
            <input
              id="brand-slug"
              className="admin-input"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={event => setForm(prev => ({ ...prev, slug: event.target.value }))}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="brand-position">
              Display order
            </label>
            <input
              id="brand-position"
              className="admin-input"
              type="number"
              min={0}
              max={999}
              value={form.position}
              onChange={event =>
                setForm(prev => ({ ...prev, position: Number(event.target.value) }))
              }
            />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="brand-description">
            Description
          </label>
          <textarea
            id="brand-description"
            className="admin-textarea"
            rows={2}
            maxLength={600}
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
          />
        </div>

        <div className="admin-field">
          <label className="admin-label">Logo</label>
          <div className="admin-catalogue-media">
            {form.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoPath} alt="Brand logo preview" className="admin-catalogue-preview admin-catalogue-preview--logo" />
            ) : (
              <div className="admin-catalogue-preview admin-catalogue-preview--empty">No logo</div>
            )}
            <div className="admin-catalogue-media-actions">
              <label className="btn-outline">
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload logo"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="admin-upload-input"
                  disabled={uploading}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
              </label>
              {form.logoPath && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setForm(prev => ({ ...prev, logoPath: "" }))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="admin-assistive-text">
            PNG, JPEG, WebP or AVIF up to 3 MB. Stored in the existing Supabase Storage bucket.
          </p>
        </div>

        <div className="admin-field">
          <span className="admin-label">Categories</span>
          <div className="admin-checkbox-grid">
            {orderedCategories.map(category => (
              <label key={category.id} className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.categoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                <span>
                  {category.depth > 0 ? "— " : ""}
                  {category.label}
                  {!category.is_active && <span className="admin-muted"> (hidden)</span>}
                </span>
              </label>
            ))}
          </div>
          <p className="admin-assistive-text">
            Which categories this brand is represented in. Products still choose their own category.
          </p>
        </div>

        <div className="admin-form-actions">
          <button className="btn-dark" type="submit" disabled={busy || uploading}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create brand"}
          </button>
        </div>
      </form>

      {loading ? (
        <AdminSpinner />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title={rows.length === 0 ? "No brands yet" : "No brands match"}
          description={
            rows.length === 0
              ? "Create the first brand above, then assign it to products."
              : "Try a different search term."
          }
        />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Logo</th>
                <th scope="col">Brand</th>
                <th scope="col">Slug</th>
                <th scope="col">Categories</th>
                <th scope="col">Order</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(brand => (
                <tr key={brand.id}>
                  <td>
                    {brand.logo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brand.logo_path} alt="" className="admin-catalogue-thumb" />
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                  <td>
                    <strong>{brand.name}</strong>
                    {brand.description && (
                      <div className="admin-muted admin-category-desc">{brand.description}</div>
                    )}
                  </td>
                  <td className="admin-muted">/{brand.slug}</td>
                  <td className="admin-muted">
                    {(brand.category_ids ?? []).length === 0
                      ? "—"
                      : (brand.category_ids ?? [])
                          .map(id => categories.find(category => category.id === id)?.label ?? "?")
                          .join(", ")}
                  </td>
                  <td>{brand.position}</td>
                  <td className="admin-table-actions">
                    <button
                      type="button"
                      className="admin-action-btn"
                      title="Edit"
                      onClick={() => startEdit(brand)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-action-btn admin-action-btn--danger"
                      title="Delete"
                      disabled={busy}
                      onClick={() => void remove(brand)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="admin-assistive-text">
        Brands have no separate active flag in the current schema; a brand is visible wherever its
        products are. A brand-level visibility switch would need an approved migration.
      </p>
    </div>
  );
}
