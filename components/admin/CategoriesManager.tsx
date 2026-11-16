"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { AdminEmptyState, AdminSpinner } from "@/lib/server/admin-ui";
import { CATEGORY_ICON_KEYS } from "@/lib/category-icons";

export type AdminCategory = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  position: number;
  is_active: boolean;
  parent_id: string | null;
  icon: string | null;
  banner_path: string | null;
};

type FormState = {
  label: string;
  slug: string;
  description: string;
  parentId: string;
  icon: string;
  bannerPath: string;
  position: number;
  isActive: boolean;
};

const EMPTY: FormState = {
  label: "",
  slug: "",
  description: "",
  parentId: "",
  icon: "",
  bannerPath: "",
  position: 0,
  isActive: true
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Full category management against `public.categories` (0007 + 0008):
 * hierarchy, description, icon, banner, visibility, ordering and safe delete.
 * Slugs are immutable because they are part of storefront URLs.
 */
export function CategoriesManager({
  initial,
  initialCounts = {}
}: {
  initial: AdminCategory[];
  initialCounts?: Record<string, number>;
}) {
  const [rows, setRows] = useState<AdminCategory[]>(initial);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "hidden">("all");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load categories.");
      setRows(data.categories ?? []);
      setCounts(data.counts ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRows(initial);
    setCounts(initialCounts);
  }, [initial, initialCounts]);

  const ordered = useMemo(
    () => [...rows].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)),
    [rows]
  );

  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);

  /** Parent options exclude the edited row and everything under it. */
  const parentOptions = useMemo(() => {
    if (!editing) return ordered;
    const blocked = new Set<string>([editing.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of ordered) {
        if (row.parent_id && blocked.has(row.parent_id) && !blocked.has(row.id)) {
          blocked.add(row.id);
          changed = true;
        }
      }
    }
    return ordered.filter(row => !blocked.has(row.id));
  }, [ordered, editing]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter(row => {
      if (status === "active" && !row.is_active) return false;
      if (status === "hidden" && row.is_active) return false;
      if (!q) return true;
      return row.label.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q);
    });
  }, [ordered, query, status]);

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const startEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({
      label: category.label,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parent_id ?? "",
      icon: category.icon ?? "",
      bannerPath: category.banner_path ?? "",
      position: category.position,
      isActive: category.is_active
    });
    setError(null);
    setNotice(null);
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, position: (ordered.at(-1)?.position ?? 0) + 1 });
    setError(null);
    setNotice(null);
  };

  const uploadBanner = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/catalogue/images?kind=category-banner", {
        method: "POST",
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The banner could not be uploaded.");
      setForm(prev => ({ ...prev, bannerPath: data.path }));
      setNotice("Banner uploaded. Save the category to apply it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The banner could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const validate = (): string | null => {
    if (!form.label.trim()) return "Label is required.";
    if (form.label.trim().length > 60) return "Label must be at most 60 characters.";
    if (!editing && !SLUG_RE.test(form.slug.trim())) {
      return "Slug must be lowercase letters, digits and dashes.";
    }
    if (form.description.trim().length > 600) return "Description must be at most 600 characters.";
    if (!Number.isInteger(form.position) || form.position < 0 || form.position > 999) {
      return "Display order must be a whole number between 0 and 999.";
    }
    if (form.bannerPath.trim().length > 300) return "Banner path must be at most 300 characters.";
    if (!editing && rows.some(row => row.slug === form.slug.trim())) {
      return "A category with that slug already exists.";
    }
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        label: form.label.trim(),
        description: form.description.trim() || null,
        parent_id: form.parentId || null,
        icon: form.icon || null,
        banner_path: form.bannerPath.trim() || null,
        position: form.position,
        is_active: form.isActive
      };
      const res = await fetch(
        editing ? `/api/admin/categories?id=${encodeURIComponent(editing.id)}` : "/api/admin/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? payload : { ...payload, slug: form.slug.trim().toLowerCase() }
          )
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The category could not be saved.");
      setNotice(editing ? "Category updated." : "Category created.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The category could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "The category could not be updated.");
  };

  const toggleActive = async (category: AdminCategory) => {
    const next = !category.is_active;
    if (
      !next &&
      !window.confirm(
        `Hide “${category.label}” from the storefront? Products, images and links are kept, and you can reactivate it at any time.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await patch(category.id, { is_active: next });
      setNotice(next ? "Category is visible again." : "Category hidden from the storefront.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The category could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const move = async (category: AdminCategory, direction: -1 | 1) => {
    const list = [...ordered];
    const index = list.findIndex(row => row.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].position !== i + 1) {
          await patch(list[i].id, { position: i + 1 });
        }
      }
      setNotice("Display order saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The order could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: AdminCategory) => {
    const productCount = counts[category.id] ?? 0;
    const hasChildren = rows.some(row => row.parent_id === category.id);
    if (productCount > 0 || hasChildren) {
      setError(
        productCount > 0
          ? `“${category.label}” still has ${productCount} product${productCount === 1 ? "" : "s"}. Deactivate it instead of deleting.`
          : `“${category.label}” still has subcategories. Move or delete them first.`
      );
      return;
    }
    if (
      !window.confirm(
        `Delete “${category.label}” permanently? This cannot be undone. If you only want to hide it, use Deactivate instead.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(category.id)}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The category could not be deleted.");
      setNotice("Category deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The category could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

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
            placeholder="Search categories…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="admin-filters">
          <label className="admin-filter">
            <span>Status</span>
            <select
              className="admin-select"
              value={status}
              onChange={event => setStatus(event.target.value as typeof status)}
            >
              <option value="all">All statuses</option>
              <option value="active">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <button type="button" className="btn-dark" onClick={startCreate} disabled={busy}>
            New category
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="admin-form admin-card">
        <div className="admin-card-header">
          <h2>{editing ? `Edit “${editing.label}”` : "New category"}</h2>
          {editing && (
            <button type="button" className="admin-card-link" onClick={resetForm}>
              <X size={14} /> Cancel edit
            </button>
          )}
        </div>

        <div className="admin-form-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="cat-label">
              Name <span className="admin-label-required">*</span>
            </label>
            <input
              id="cat-label"
              className="admin-input"
              required
              maxLength={60}
              value={form.label}
              onChange={event => setForm(prev => ({ ...prev, label: event.target.value }))}
            />
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="cat-slug">
              Slug <span className="admin-label-required">*</span>
            </label>
            <input
              id="cat-slug"
              className="admin-input"
              required
              disabled={Boolean(editing)}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={event => setForm(prev => ({ ...prev, slug: event.target.value }))}
            />
            <p className="admin-assistive-text">
              {editing
                ? "Slugs are part of storefront URLs and cannot be changed after creation."
                : "Lowercase letters, digits and dashes. Used in /shop?category=…"}
            </p>
          </div>
        </div>

        <div className="admin-form-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="cat-parent">
              Parent category
            </label>
            <select
              id="cat-parent"
              className="admin-select"
              value={form.parentId}
              onChange={event => setForm(prev => ({ ...prev, parentId: event.target.value }))}
            >
              <option value="">Top level (no parent)</option>
              {parentOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.parent_id ? "— " : ""}
                  {option.label}
                </option>
              ))}
            </select>
            <p className="admin-assistive-text">
              Subcategories appear under their parent on the category page and in the shop sidebar.
            </p>
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="cat-icon">
              Icon
            </label>
            <select
              id="cat-icon"
              className="admin-select"
              value={form.icon}
              onChange={event => setForm(prev => ({ ...prev, icon: event.target.value }))}
            >
              <option value="">Built-in icon for this slug</option>
              {CATEGORY_ICON_KEYS.map(key => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="cat-position">
              Display order
            </label>
            <input
              id="cat-position"
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
          <label className="admin-label" htmlFor="cat-description">
            Description
          </label>
          <textarea
            id="cat-description"
            className="admin-textarea"
            rows={2}
            maxLength={600}
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            placeholder="Shown on the category page. Leave empty to use the built-in copy."
          />
        </div>

        <div className="admin-field">
          <label className="admin-label">Banner image</label>
          <div className="admin-catalogue-media">
            {form.bannerPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.bannerPath} alt="Category banner preview" className="admin-catalogue-preview" />
            ) : (
              <div className="admin-catalogue-preview admin-catalogue-preview--empty">
                No banner
              </div>
            )}
            <div className="admin-catalogue-media-actions">
              <label className="btn-outline">
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload banner"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="admin-upload-input"
                  disabled={uploading}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void uploadBanner(file);
                  }}
                />
              </label>
              {form.bannerPath && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setForm(prev => ({ ...prev, bannerPath: "" }))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="admin-assistive-text">
            JPEG, PNG, WebP or AVIF, up to 3 MB. Without a banner the category page uses a product image.
          </p>
        </div>

        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={event => setForm(prev => ({ ...prev, isActive: event.target.checked }))}
          />
          <span>Visible in the storefront</span>
        </label>

        <div className="admin-form-actions">
          <button className="btn-dark" type="submit" disabled={busy || uploading}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create category"}
          </button>
        </div>
      </form>

      {loading ? (
        <AdminSpinner />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title={rows.length === 0 ? "No categories yet" : "No categories match"}
          description={
            rows.length === 0
              ? "Create the first category above."
              : "Try a different search term or status filter."
          }
        />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Category</th>
                <th scope="col">Slug</th>
                <th scope="col">Parent</th>
                <th scope="col">Products</th>
                <th scope="col">Status</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(category => {
                const parent = category.parent_id ? byId.get(category.parent_id) : null;
                return (
                  <tr key={category.id}>
                    <td>
                      <div className="admin-order-controls">
                        <button
                          type="button"
                          className="admin-action-btn"
                          title="Move up"
                          disabled={busy}
                          onClick={() => void move(category, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span className="admin-muted">{category.position}</span>
                        <button
                          type="button"
                          className="admin-action-btn"
                          title="Move down"
                          disabled={busy}
                          onClick={() => void move(category, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={category.parent_id ? "admin-category-child" : undefined}>
                        {category.label}
                      </span>
                      {category.description && (
                        <div className="admin-muted admin-category-desc">{category.description}</div>
                      )}
                    </td>
                    <td className="admin-muted">/{category.slug}</td>
                    <td className="admin-muted">{parent?.label ?? "—"}</td>
                    <td>{counts[category.id] ?? 0}</td>
                    <td>
                      <span className={`admin-status-pill ${category.is_active ? "is-active" : "is-hidden"}`}>
                        {category.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                        {category.is_active ? "Visible" : "Hidden"}
                      </span>
                    </td>
                    <td className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-action-btn"
                        title="Edit"
                        onClick={() => startEdit(category)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn"
                        title={category.is_active ? "Deactivate" : "Reactivate"}
                        disabled={busy}
                        onClick={() => void toggleActive(category)}
                      >
                        {category.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--danger"
                        title="Delete"
                        disabled={busy || (counts[category.id] ?? 0) > 0}
                        onClick={() => void remove(category)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
