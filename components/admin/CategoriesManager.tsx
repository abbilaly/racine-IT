"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { AdminSpinner, AdminEmptyState } from "@/lib/server/admin-ui";

type Category = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  position?: number;
};

const EMPTY = { slug: "", label: "", description: "" };

/**
 * Full CRUD for categories. Creating keeps the slug immutable (it is part of
 * storefront URLs); editing only changes label, description and position so
 * existing product links keep working.
 */
export function CategoriesManager({ initial }: { initial: Category[] }) {
  const [rows, setRows] = useState<Category[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (res.ok) setRows(data.categories ?? []);
    } catch {
      // keep the server-rendered list when the refresh fails
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (category: Category) => {
    setEditing(category);
    setForm({
      slug: category.slug,
      label: category.label,
      description: category.description ?? "",
    });
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        editing ? `/api/admin/categories?id=${editing.id}` : "/api/admin/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { label: form.label, description: form.description }
              : { slug: form.slug, label: form.label, description: form.description || undefined }
          ),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save category.");
      setNotice(editing ? "Category updated." : "Category created.");
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Delete the category "${category.label}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/categories?id=${category.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete category.");
      setNotice("Category deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      <form onSubmit={submit} className="admin-form" style={{ maxWidth: 560 }}>
        <h3 className="admin-form-section-title">{editing ? "Edit category" : "New category"}</h3>
        <div className="admin-field">
          <label className="admin-label" htmlFor="cat-label">
            Label <span className="admin-label-required">*</span>
          </label>
          <input
            id="cat-label"
            className="admin-input"
            required
            maxLength={60}
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
          />
          {editing && (
            <p className="admin-assistive-text">
              The slug is part of storefront URLs and cannot be changed after creation.
            </p>
          )}
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="cat-description">Description</label>
          <textarea
            id="cat-description"
            className="admin-textarea"
            rows={2}
            maxLength={600}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="admin-form-actions">
          <button className="btn-dark" type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create category"}
          </button>
          {editing && (
            <button
              className="btn-outline"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <AdminEmptyState title="No categories yet" description="Create the first category above." />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Slug</th>
                <th scope="col">Description</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((category) => (
                <tr key={category.id}>
                  <td>{category.label}</td>
                  <td className="admin-muted">/{category.slug}</td>
                  <td className="admin-muted">{category.description || "—"}</td>
                  <td className="admin-table-actions">
                    <button className="admin-action-btn" type="button" title="Edit" onClick={() => startEdit(category)}>
                      <Pencil size={14} />
                    </button>
                    <button className="admin-action-btn" type="button" title="Delete" disabled={busy} onClick={() => remove(category)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}