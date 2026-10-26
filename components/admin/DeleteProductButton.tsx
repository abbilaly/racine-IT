"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteProductButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="admin-icon-btn"
        disabled={busy}
        aria-label={`Delete ${title}`}
        onClick={async () => {
          if (!window.confirm(`Delete “${title}” from the catalogue?`)) return;
          setBusy(true);
          setError(null);
          try {
            const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
              method: "DELETE"
            });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
              setError(body.error ?? "The product could not be deleted.");
              setBusy(false);
              return;
            }
            router.refresh();
          } catch {
            setError("We could not reach the server.");
            setBusy(false);
          }
        }}
      >
        <Trash2 size={14} />
      </button>
      {error && <span className="admin-inline-error">{error}</span>}
    </>
  );
}
