"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminSpinner, AdminEmptyState } from "@/lib/server/admin-ui";

type Brand = { id: string; name: string; slug: string; description: string | null; position: number };

const EMPTY = { name: "", slug: "", description: "" };

/**
 * Full CRUD for brands: loads the list from the admin API, creates,
 * edits and deletes records. Deleting a brand that is still assigned to
 * products is refused by the API with a clear message.
 */
export function BrandsManager({ initial = [] }: { initial?: Brand[] }) {
  const [rows, setRows] = useState<Brand[] | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brands?page=1&limit=200");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load brands.");
      setRows(data.brands ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load brands.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({ name: brand.name, slug: brand.slug, description: brand.description ?? "" });
    setNotice(null);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(editing ? `/api/admin/brands?id=${editing.id}` : "/api/admin/brands", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save brand.");
      setNotice(editing ? "Brand updated." : "Brand created.");
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save brand.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (brand: Brand) => {
    if (!window.confirm(`Delete the brand "${brand.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/brands?id=${brand.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete brand.");
      setNotice("Brand deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete brand.");
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) return <AdminSpinner />;

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
        <h3 className="admin-form-section-title">{editing ? "Edit brand" : "New brand"}</h3>
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
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="brand-description">Description</label>
          <textarea
            id="brand-description"
            className="admin-textarea"
            rows={2}
            maxLength={600}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="admin-form-actions">
          <button className="btn-dark" type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create brand"}
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
        <AdminEmptyState title="No brands yet" description="Create the first brand above." />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Description</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((brand) => (
                <tr key={brand.id}>
                  <td>{brand.name}</td>
                  <td className="admin-muted">/{brand.slug}</td>
                  <td className="admin-muted">{brand.description || "—"}</td>
                  <td className="admin-table-actions">
                    <button className="admin-action-btn" type="button" title="Edit" onClick={() => startEdit(brand)}>
                      <Pencil size={14} />
                    </button>
                    <button className="admin-action-btn" type="button" title="Delete" disabled={busy} onClick={() => remove(brand)}>
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
        <Plus size={12} /> Brands can be assigned to products on the product edit page.
      </p>
    </div>
  );
}