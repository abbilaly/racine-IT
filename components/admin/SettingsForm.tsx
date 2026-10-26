"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminSettings = {
  storeName: string;
  standardShipping: number;
  expressShipping: number;
  checkoutEnabled: boolean;
};

export default function SettingsForm({ initial }: { initial: AdminSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="admin-form"
      onSubmit={async event => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
          const response = await fetch("/api/admin/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings)
          });
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) {
            setError(body.error ?? "Settings could not be saved.");
            return;
          }
          setSaved(true);
          router.refresh();
        } catch {
          setError("We could not reach the server.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        Store name
        <input
          type="text"
          required
          maxLength={60}
          value={settings.storeName}
          onChange={e => setSettings(s => ({ ...s, storeName: e.target.value }))}
        />
      </label>

      <div className="field-row">
        <label className="field">
          Standard delivery fee (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.standardShipping}
            onChange={e => setSettings(s => ({ ...s, standardShipping: Number(e.target.value) }))}
          />
        </label>
        <label className="field">
          Express delivery fee (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.expressShipping}
            onChange={e => setSettings(s => ({ ...s, expressShipping: Number(e.target.value) }))}
          />
        </label>
      </div>

      <label className="choice">
        <input
          type="checkbox"
          checked={settings.checkoutEnabled}
          onChange={e => setSettings(s => ({ ...s, checkoutEnabled: e.target.checked }))}
        />
        <span>
          <strong>Checkout enabled</strong>
          <small>Turn off to stop accepting orders while you restock</small>
        </span>
      </label>

      {error && <p className="checkout-error" role="alert">{error}</p>}
      {saved && <p className="muted-note">Settings saved.</p>}

      <div className="admin-form-actions">
        <button type="submit" className="btn-dark" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
