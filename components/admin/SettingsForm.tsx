"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Button } from "@/components/admin/ui/button";

export type AdminSettings = {
  storeName: string;
  /** ISO code the stored prices are denominated in. Display only. */
  currency: string;
  standardShipping: number;
  expressShipping: number;
  checkoutEnabled: boolean;
};

const CURRENCY_OPTIONS = [
  { code: "MAD", label: "Moroccan dirham (MAD)" },
  { code: "USD", label: "US dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "Pound sterling (GBP)" }
] as const;

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-1 text-[11px] text-muted-foreground">{children}</p>;
}

export default function SettingsForm({ initial }: { initial: AdminSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    settings.storeName !== initial.storeName ||
    settings.currency !== initial.currency ||
    settings.standardShipping !== initial.standardShipping ||
    settings.expressShipping !== initial.expressShipping ||
    settings.checkoutEnabled !== initial.checkoutEnabled;

  return (
    <form
      className="flex max-w-3xl flex-col gap-4"
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
      <Card className="gap-0 p-5">
        <div className="mb-4">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Store profile</h2>
          <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
            Shown in the storefront header, emails and order documents.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="store-name" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Store name
          </Label>
          <Input
            id="store-name"
            type="text"
            required
            maxLength={60}
            value={settings.storeName}
            onChange={e => setSettings(s => ({ ...s, storeName: e.target.value }))}
            className="h-9 max-w-sm text-[13px]"
          />
          <FieldHint>Up to 60 characters.</FieldHint>
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <div className="mb-4">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Market &amp; currency</h2>
          <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
            The currency every price, delivery fee and total is displayed in.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Store currency
          </Label>
          <select
            id="currency"
            value={settings.currency}
            onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
            className="h-9 max-w-sm rounded-lg border border-input bg-background px-2 text-[13px]"
          >
            {CURRENCY_OPTIONS.map(option => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldHint>
            Display only: stored prices are never converted automatically. Confirm the catalogue is
            priced in this currency before switching — for example, reprice the products in MAD
            before changing a USD store to MAD.
          </FieldHint>
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <div className="mb-4">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Delivery fees</h2>
          <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
            Charged at checkout and included in order totals.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="standard-shipping" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Standard delivery
            </Label>
            <div className="flex items-center">
              <span className="grid h-9 place-items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-[12px] text-muted-foreground">
                {settings.currency}
              </span>
              <Input
                id="standard-shipping"
                type="number"
                min="0"
                step="0.01"
                value={settings.standardShipping}
                onChange={e => setSettings(s => ({ ...s, standardShipping: Number(e.target.value) }))}
                className="h-9 rounded-l-none text-[13px] tabular-nums"
              />
            </div>
            <FieldHint>{settings.currency}, per order.</FieldHint>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="express-shipping" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Express delivery
            </Label>
            <div className="flex items-center">
              <span className="grid h-9 place-items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-[12px] text-muted-foreground">
                {settings.currency}
              </span>
              <Input
                id="express-shipping"
                type="number"
                min="0"
                step="0.01"
                value={settings.expressShipping}
                onChange={e => setSettings(s => ({ ...s, expressShipping: Number(e.target.value) }))}
                className="h-9 rounded-l-none text-[13px] tabular-nums"
              />
            </div>
            <FieldHint>{settings.currency}, per order.</FieldHint>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <div className="mb-3">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Checkout availability</h2>
          <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
            Turning checkout off keeps the catalogue browsable but stops new orders.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-3">
          <input
            type="checkbox"
            checked={settings.checkoutEnabled}
            onChange={e => setSettings(s => ({ ...s, checkoutEnabled: e.target.checked }))}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-foreground">Checkout enabled</span>
            <span className="block text-[11px] text-muted-foreground">
              Disable while restocking or running maintenance.
            </span>
          </span>
          <span
            className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              settings.checkoutEnabled
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {settings.checkoutEnabled ? "Open" : "Closed"}
          </span>
        </label>
      </Card>

      {error && (
        <p
          className="m-0 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          role="alert"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {saved && (
        <p
          className="m-0 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Settings saved. The storefront reads these values immediately.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>
    </form>
  );
}
