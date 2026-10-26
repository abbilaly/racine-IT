"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["received", "processing", "shipped", "delivered", "cancelled"] as const;

const LABELS: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export default function OrderStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <select
        aria-label="Order status"
        className="admin-status-select"
        value={value}
        disabled={busy}
        onChange={async event => {
          const status = event.target.value;
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/admin/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, status })
            });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) setError(body.error ?? "Status could not be updated.");
            else router.refresh();
          } catch {
            setError("We could not reach the server.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {STATUSES.map(status => (
          <option key={status} value={status}>{LABELS[status]}</option>
        ))}
      </select>
      {error && <span className="admin-inline-error">{error}</span>}
    </>
  );
}
