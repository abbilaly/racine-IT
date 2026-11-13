"use client";

import { useState } from "react";
import type { FollowupRule, FollowupTargetType } from "@/lib/server/email-center";

export interface FollowupFormProps {
  rule?: FollowupRule | null;
  onSave: (values: FollowupFormValues) => void;
  onCancel: () => void;
}

export type FollowupFormValues = {
  targetType: FollowupTargetType;
  targetId?: string;
  initialDelayDays: number;
  subject: string;
  html: string;
  name?: string;
  templateKind?: string;
};

export function FollowupForm({ rule, onSave, onCancel }: FollowupFormProps) {
  const initial: FollowupFormValues = rule
    ? {
        targetType: rule.targetType,
        targetId: rule.targetId,
        initialDelayDays: rule.initialDelayDays,
        subject: rule.subject,
        html: rule.html,
        name: rule.name,
        templateKind: rule.templateKind,
      }
    : {
        targetType: "quotation",
        targetId: undefined,
        initialDelayDays: 3,
        subject: "",
        html: "",
        name: undefined,
        templateKind: "quotation",
      };

  const [form, setForm] = useState<FollowupFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<FollowupFormValues>) => {
    setForm((prev: FollowupFormValues) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.targetType) { setError("Target type is required."); return; }
    if (form.targetType === "order" && !form.targetId) { setError("Order id is required for order follow-ups."); return; }
    if (form.initialDelayDays < 1 || form.initialDelayDays > 90) { setError("Initial delay must be between 1 and 90 days."); return; }
    if (!form.subject.trim()) { setError("Subject is required."); return; }
    if (!form.html.trim()) { setError("Email body is required."); return; }
    setSaving(true);
    try { onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="followup-form">
      <div className="followup-form-head">
        <h1>{rule ? "Edit follow-up rule" : "New follow-up rule"}</h1>
        <p>Schedule reminders for quotations or orders. Processing requires Cloudflare Cron.</p>
      </div>
      {error ? <div className="followup-error">{error}</div> : null}
      <div className="followup-form-section">
        <h2>Target</h2>
        <div className="followup-form-grid">
          <div className="followup-field">
            <label>Target type *</label>
            <div className="followup-field-row">
              <label className="followup-radio">
                <input type="radio" name="followup-target-type" checked={form.targetType === "quotation"} onChange={() => update({ targetType: "quotation", targetId: undefined })} />
                <span>Quotation</span>
              </label>
              <label className="followup-radio">
                <input type="radio" name="followup-target-type" checked={form.targetType === "order"} onChange={() => update({ targetType: "order" })} />
                <span>Order</span>
              </label>
            </div>
          </div>
          {form.targetType === "order" ? (
            <div className="followup-field">
              <label>Order id *</label>
              <input type="text" className="followup-input" value={form.targetId ?? ""} onChange={(e) => update({ targetId: e.target.value })} placeholder="Order id" />
            </div>
          ) : null}
          <div className="followup-field">
            <label>Rule name</label>
            <input type="text" className="followup-input" value={form.name ?? ""} onChange={(e) => update({ name: e.target.value })} placeholder="Quotation follow-up" />
          </div>
        </div>
      </div>
      <div className="followup-form-section">
        <h2>Email</h2>
        <div className="followup-form-grid">
          <div className="followup-field">
            <label>Subject *</label>
            <input type="text" className="followup-input" value={form.subject} onChange={(e) => update({ subject: e.target.value })} maxLength={120} placeholder="Following up on your quotation" />
          </div>
          <div className="followup-field followup-field--wide">
            <label>Email body (HTML) *</label>
            <textarea className="followup-textarea" value={form.html} onChange={(e) => update({ html: e.target.value })} rows={12} maxLength={50000} placeholder="<p>Hi,</p><p>We wanted to follow up on your request.</p>" />
          </div>
        </div>
      </div>
      <div className="followup-form-section">
        <h2>Timing</h2>
        <div className="followup-form-grid">
          <div className="followup-field">
            <label>Initial delay (days) *</label>
            <input type="number" min={1} max={90} className="followup-input" value={form.initialDelayDays} onChange={(e) => update({ initialDelayDays: parseInt(e.target.value, 10) || 0 })} />
          </div>
          <div className="followup-field">
            <label>Template kind</label>
            <select className="followup-input" value={form.templateKind ?? "quotation"} onChange={(e) => update({ templateKind: e.target.value })}>
              <option value="quotation">Quotation</option>
              <option value="order_status">Order status</option>
            </select>
          </div>
        </div>
      </div>
      <div className="followup-form-actions">
        <button type="button" className="followup-button followup-button--secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="followup-button followup-button--primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : rule ? "Save changes" : "Create rule"}
        </button>
      </div>
    </div>
  );
}
