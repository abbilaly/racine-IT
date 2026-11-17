"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AdminSpinner, AdminEmptyState } from "@/lib/server/admin-ui";

type Supplier = {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  enabled: boolean;
  last_sync_at: string | null;
};

type SyncLog = {
  id: string;
  supplier_id: string;
  status: string;
  message: string;
  rows_processed: number;
  rows_failed: number;
  created_at: string;
};

const EMPTY = {
  name: "",
  slug: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

/**
 * Supplier management: profiles, enable/disable and synchronization logs.
 * No supplier API is called from here — synchronization stays a CSV workflow
 * until real credentials and documentation exist.
 */
export function SuppliersManager() {
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      const [suppliersRes, logsRes] = await Promise.all([
        fetch("/api/admin/suppliers"),
        fetch("/api/admin/suppliers?type=logs&limit=20"),
      ]);
      const suppliersData = await suppliersRes.json().catch(() => ({}));
      if (!suppliersRes.ok) throw new Error(suppliersData.error || "Could not load suppliers.");
      setRows(Array.isArray(suppliersData.suppliers) ? suppliersData.suppliers : []);

      const logsData = await logsRes.json().catch(() => ({}));
      if (logsRes.ok) setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load suppliers.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      slug: supplier.slug,
      contactName: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      website: supplier.website ?? "",
      notes: supplier.notes ?? "",
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
        editing ? `/api/admin/suppliers?supplierId=${editing.id}` : "/api/admin/suppliers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save supplier.");
      setNotice(editing ? "Supplier updated." : "Supplier created.");
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save supplier.");
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (supplier: Supplier) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suppliers?supplierId=${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !supplier.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not update supplier.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update supplier.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`Delete the supplier "${supplier.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/suppliers?supplierId=${supplier.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete supplier.");
      setNotice("Supplier deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete supplier.");
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

      <form onSubmit={submit} className="admin-form" style={{ maxWidth: 640 }}>
        <h3 className="admin-form-section-title">{editing ? "Edit supplier" : "New supplier"}</h3>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-name">
            Name <span className="admin-label-required">*</span>
          </label>
          <input
            id="sup-name"
            className="admin-input"
            required
            maxLength={160}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-slug">
            Slug <span className="admin-label-required">*</span>
          </label>
          <input
            id="sup-slug"
            className="admin-input"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-contact">Contact name</label>
          <input
            id="sup-contact"
            className="admin-input"
            maxLength={160}
            value={form.contactName}
            onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-email">Email</label>
          <input
            id="sup-email"
            type="email"
            className="admin-input"
            maxLength={254}
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-phone">Phone</label>
          <input
            id="sup-phone"
            className="admin-input"
            maxLength={60}
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-website">Website</label>
          <input
            id="sup-website"
            className="admin-input"
            maxLength={300}
            value={form.website}
            onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sup-notes">Notes</label>
          <textarea
            id="sup-notes"
            className="admin-textarea"
            rows={2}
            maxLength={2000}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        <div className="admin-form-actions">
          <button className="btn-dark" type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create supplier"}
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
        <AdminEmptyState
          title="No suppliers yet"
          description="Create a supplier profile to group imported products and costs."
        />
      ) : (
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Supplier</th>
                <th scope="col">Contact</th>
                <th scope="col">Enabled</th>
                <th scope="col">Last sync</th>
                <th scope="col" className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => (
                <tr key={supplier.id}>
                  <td>
                    <span className="admin-product-title">{supplier.name}</span>
                    <br />
                    <span className="admin-muted">/{supplier.slug}</span>
                  </td>
                  <td className="admin-muted">
                    {supplier.email || supplier.phone || supplier.website || "—"}
                  </td>
                  <td>
                    <button
                      className="admin-action-btn"
                      type="button"
                      title={supplier.enabled ? "Disable supplier" : "Enable supplier"}
                      disabled={busy}
                      onClick={() => toggleEnabled(supplier)}
                    >
                      {supplier.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="admin-muted">
                    {supplier.last_sync_at ? new Date(supplier.last_sync_at).toLocaleString() : "Never"}
                  </td>
                  <td className="admin-table-actions">
                    <button className="admin-action-btn" type="button" title="Edit" onClick={() => startEdit(supplier)}>
                      <Pencil size={14} />
                    </button>
                    <button className="admin-action-btn" type="button" title="Delete" disabled={busy} onClick={() => remove(supplier)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="admin-card">
        <div className="admin-card-header">
          <h2>Synchronization log</h2>
          <button className="admin-action-btn" type="button" title="Refresh" onClick={load}>
            <RefreshCw size={14} />
          </button>
        </div>
        {logs.length === 0 ? (
          <AdminEmptyState
            title="No synchronization runs yet"
            description="CSV import runs are recorded here with row counts and errors."
          />
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="admin-muted">{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.status}</td>
                    <td className="admin-muted">
                      {log.rows_processed} processed / {log.rows_failed} failed
                    </td>
                    <td className="admin-muted">{log.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-assistive-text">
        <Plus size={12} /> Supplier-reported availability is tracked separately from your physical
        inventory — importing supplier data never changes stock on hand.
      </p>
    </div>
  );
}