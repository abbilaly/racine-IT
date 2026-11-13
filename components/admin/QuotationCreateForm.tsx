"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";

/**
 * Creates a draft quotation, then opens it so lines and terms can be added.
 */
export function QuotationCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerCompany: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerCompany: form.customerCompany || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create quotation.");
        return;
      }
      router.push(`/admin/quotations/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="btn-dark" type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        New quotation
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="admin-form" style={{ maxWidth: 480 }}>
      <div className="admin-field">
        <label className="admin-label" htmlFor="q-customer">
          Customer name <span className="admin-label-required">*</span>
        </label>
        <input
          id="q-customer"
          className="admin-input"
          required
          maxLength={120}
          value={form.customerName}
          onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
        />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="q-email">
          Customer email <span className="admin-label-required">*</span>
        </label>
        <input
          id="q-email"
          type="email"
          className="admin-input"
          required
          maxLength={254}
          value={form.customerEmail}
          onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
        />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="q-company">
          Company (optional)
        </label>
        <input
          id="q-company"
          className="admin-input"
          maxLength={160}
          value={form.customerCompany}
          onChange={(e) => setForm((prev) => ({ ...prev, customerCompany: e.target.value }))}
        />
      </div>
      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      <div className="admin-form-actions">
        <button className="btn-dark" type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create draft"}
        </button>
        <button className="btn-outline" type="button" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}