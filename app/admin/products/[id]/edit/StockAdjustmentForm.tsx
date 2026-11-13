"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface StockAdjustmentFormProps {
  productId: string;
}

export function StockAdjustmentForm({ productId }: StockAdjustmentFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/products/${productId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, change: parseFloat(change), note: note || null }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error || "Could not adjust stock.");
        return;
      }

      setSuccess(true);
      setReason("");
      setChange("");
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-stock-adjust-form">
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="adjustment-reason" className="admin-label">
            Reason <span className="admin-label-required">*</span>
          </label>
          <select
            id="adjustment-reason"
            className="admin-select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          >
            <option value="" disabled>Select a reason…</option>
            <option value="received">Received</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
            <option value="adjustment">Manual adjustment</option>
          </select>
        </div>
        <div className="admin-field admin-field--grow">
          <label htmlFor="adjustment-change" className="admin-label">
            Quantity <span className="admin-label-required">*</span>
          </label>
          <div className="admin-input-group">
            <button
              type="button"
              className="admin-adjust-btn admin-adjust-btn--decrement"
              onClick={() => setChange((prev) => String(Math.max(0, parseFloat(prev) - 1)))}
            >
              −
            </button>
            <input
              id="adjustment-change"
              type="number"
              className="admin-input"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              min="0"
              max="99999"
              step="1"
              required
              placeholder="0"
            />
            <button
              type="button"
              className="admin-adjust-btn admin-adjust-btn--increment"
              onClick={() => setChange((prev) => String(parseFloat(prev) + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="adjustment-note" className="admin-label">
          Note <span className="admin-label-optional">(optional)</span>
        </label>
        <textarea
          id="adjustment-note"
          className="admin-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note (optional)"
        />
      </div>

      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="admin-form-success" role="status">
          Stock adjusted successfully.
        </div>
      )}

      <div className="admin-form-actions">
        <button
          type="submit"
          className="btn-dark"
          disabled={submitting || !reason || !change || parseFloat(change) <= 0}
        >
          {submitting ? "Saving…" : "Adjust stock"}
        </button>
      </div>
    </form>
  );
}
