"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Clock, XCircle, Truck } from "lucide-react";

interface OrderStatusFormProps {
  orderId: string;
  currentStatus?: string;
}

const STATUS_OPTIONS = [
  { value: "received", label: "Received", icon: Clock },
  { value: "processing", label: "Processing", icon: Clock },
  { value: "shipped", label: "Shipped", icon: Truck },
  { value: "delivered", label: "Delivered", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

export function OrderStatusForm({ orderId, currentStatus }: OrderStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Could not update status.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      router.refresh();
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="admin-status-updated" role="status">
        <CheckCircle size={16} />
        <span>Status updated successfully.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="admin-status-form">
      <div className="admin-status-select-wrap">
        <label htmlFor={`order-status-${orderId}`} className="admin-label">
          Status
        </label>
        <div className="admin-status-select">
          <select
            id={`order-status-${orderId}`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Change status…</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="admin-status-btn"
            disabled={!status || loading}
          >
            {loading ? "Saving…" : "Update"}
          </button>
        </div>
      </div>
      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
