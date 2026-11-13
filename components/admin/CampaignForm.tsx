"use client";

import { useState } from "react";
import type { EmailKind } from "@/lib/server/email-center";

export type CampaignDraft = {
  id?: string;
  name: string;
  kind: EmailKind;
  subject: string;
  html: string;
  recipientSelection: "test" | "manual";
  testRecipient?: string;
  manualRecipients?: string[];
  status: string;
  createdBy?: string;
  createdAt?: string;
};

export type FollowupFormValues = {
  targetType: "quotation" | "order";
  targetId?: string;
  initialDelayDays: number;
  subject: string;
  html: string;
  name?: string;
  status?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

interface FieldProps {
  label: string;
  required?: boolean;
  type?: string;
  value: string | undefined | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  multiline?: boolean;
  children?: React.ReactNode;
}

function Field({ label, required, type = "text", value, onChange, placeholder, multiline, children }: FieldProps) {
  const id = `field-${label.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
  return (
    <div className="campaign-field">
      <label htmlFor={id} className="campaign-field-label">
        {label}
        {required ? " *" : ""}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="campaign-textarea"
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={placeholder}
          rows={10}
        />
      ) : children ? (
        <select id={id} className="campaign-select" value={String(value ?? "")} onChange={onChange}>
          {children}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          className="campaign-input"
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function CampaignForm({ draft, onSave, onCancel }: { draft?: CampaignDraft | null; onSave: (draft: CampaignDraft) => void; onCancel: () => void }) {
  const initial: CampaignDraft = draft ?? {
    id: undefined,
    name: "",
    kind: "order_confirmation",
    subject: "Order confirmed",
    html: "",
    recipientSelection: "test",
    testRecipient: "",
    manualRecipients: [],
    status: "draft",
    createdBy: undefined,
    createdAt: undefined,
  };

  const [form, setForm] = useState<CampaignDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<CampaignDraft>) => {
    setForm((prev: CampaignDraft) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) { setError("Campaign name is required."); return; }
    if (!form.subject.trim()) { setError("Subject is required."); return; }
    if (!form.html.trim()) { setError("Email body is required."); return; }
    if (form.recipientSelection === "test" && !(form.testRecipient ?? "").trim()) { setError("Test recipient is required for test-only campaigns."); return; }
    if (form.recipientSelection === "manual" && form.manualRecipients && form.manualRecipients.length === 0) { setError("At least one manual recipient is required."); return; }
    setSaving(true);
    try { onSave(form); } finally { setSaving(false); }
  };

  const manualRecipients = form.manualRecipients ?? [];

  return (
    <div className="campaign-form">
      <div className="campaign-form-head">
        <div>
          <h1>{draft?.id ? "Edit campaign" : "New campaign"}</h1>
          <p>Create or edit a campaign draft. Sending is a separate confirm step.</p>
        </div>
        {draft?.id ? <span className="campaign-status">{draft.status}</span> : null}
      </div>
      {error ? <div className="campaign-error">{error}</div> : null}
      <div className="campaign-form-section">
        <h2>Campaign details</h2>
        <div className="campaign-form-grid">
          <Field label="Campaign name" required value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Black Friday follow-up" />
          <Field label="Kind" required value={form.kind} onChange={(e) => update({ kind: e.target.value as EmailKind })}>
            <option value="order_confirmation">Order confirmation</option>
            <option value="order_status">Order status</option>
            <option value="quotation">Quotation</option>
            <option value="admin_notification">Admin notification</option>
          </Field>
          <Field label="Subject" required value={form.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="Your order is confirmed" />
        </div>
      </div>
      <div className="campaign-form-section">
        <h2>Email body</h2>
        <Field label="HTML body" required multiline value={form.html} onChange={(e) => update({ html: e.target.value })} placeholder="<p>Hello,</p><p>This is a test campaign.</p>" />
        <p className="campaign-hint">Only plain HTML is rendered. Links and styles are included as written.</p>
      </div>
      <div className="campaign-form-section">
        <h2>Recipients</h2>
        <div className="campaign-form-grid">
          <Field label="Recipient mode" required value={form.recipientSelection} onChange={(e) => update({ recipientSelection: e.target.value as "test" | "manual", testRecipient: "", manualRecipients: [] })}>
            <option value="test">Test recipient</option>
            <option value="manual">Manual recipients</option>
          </Field>
          {form.recipientSelection === "test" ? (
            <Field label="Test recipient" required type="email" value={form.testRecipient ?? ""} onChange={(e) => update({ testRecipient: e.target.value })} placeholder="you@yourdomain.test" />
          ) : (
            <div className="campaign-manual-recipients">
              {manualRecipients.map((email, index) => (
                <div key={index} className="campaign-manual-recipient">
                  <input
                    type="email"
                    className="campaign-input"
                    value={email}
                    onChange={(e) => {
                      const next = [...manualRecipients];
                      next[index] = e.target.value;
                      update({ manualRecipients: next });
                    }}
                    placeholder="customer@domain.test"
                  />
                  <button type="button" className="campaign-remove" onClick={() => { const next = manualRecipients.filter((_, i) => i !== index); update({ manualRecipients: next }); }}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="campaign-add" onClick={() => update({ manualRecipients: [...manualRecipients, ""] })}>
                Add recipient
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="campaign-form-actions">
        <button type="button" className="campaign-button campaign-button--secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="campaign-button campaign-button--primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : draft?.id ? "Save changes" : "Create campaign"}
        </button>
      </div>
    </div>
  );
}
