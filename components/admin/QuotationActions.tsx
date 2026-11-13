"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Eye, FileText, Mail, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";

type Line = { id: string; title: string; qty: number };

type ProductOption = { id: string; slug: string; title: string; price_cents: number };

const STATUS_OPTIONS = ["draft", "sent", "accepted", "rejected"];

interface QuotationActionsProps {
  quotationId: string;
  currentStatus: string;
  customerName: string;
  customerEmail: string;
  lines: Line[];
}

export function QuotationActions({
  quotationId,
  currentStatus,
  customerName,
  customerEmail,
  lines,
}: QuotationActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);

  // add-line form state
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [picked, setPicked] = useState<ProductOption | null>(null);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  // convert form state
  const [showConvert, setShowConvert] = useState(false);
  const [convert, setConvert] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    customerCity: "",
    customerPostal: "",
    customerCountry: "",
    delivery: "standard",
    payment: "invoice",
  });

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  const patch = async (search: string, payload?: unknown) => {
    const res = await fetch(`/api/admin/quotations?quotationId=${quotationId}${search}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

  const changeStatus = async (next: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await patch("", { status: next });
      setStatus(next);
      setNotice(`Status changed to ${next}.`);
      router.refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  };

  const searchProducts = async () => {
    if (!query.trim()) return;
    try {
      const res = await fetch(`/api/admin/products/list?q=${encodeURIComponent(query)}&limit=8`);
      const data = await res.json();
      setOptions(res.ok ? (data.products ?? []) : []);
    } catch {
      setOptions([]);
    }
  };

  const addLine = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const price = unitPrice ? Math.round(parseFloat(unitPrice) * 100) : picked.price_cents;
      if (!Number.isFinite(price) || price < 0) throw new Error("Unit price is invalid.");
      await patch("&action=add-line", {
        product_id: picked.id,
        slug: picked.slug,
        title: picked.title,
        qty: Math.max(1, Math.floor(qty)),
        unit_price_cents: price,
        line_total_cents: price * Math.max(1, Math.floor(qty)),
      });
      await patch("&action=recalculate-totals");
      setPicked(null);
      setQuery("");
      setOptions([]);
      setUnitPrice("");
      setQty(1);
      setNotice("Line added.");
      router.refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not add line.");
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (lineId: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await patch(`&action=remove-line&lineId=${lineId}`);
      await patch("&action=recalculate-totals");
      setNotice("Line removed.");
      router.refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not remove line.");
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/quotations/${quotationId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: customerEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send email.");
      setNotice(`Email accepted by the provider (${data.provider_message_id ?? "queued"}).`);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setBusy(false);
    }
  };

  const convertToOrder = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await patch("&action=convert", convert);
      setNotice("Quotation converted to an order. No payment was taken.");
      router.push(`/admin/orders/${data.order_id}`);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not convert quotation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && (
        <div className="admin-form-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="admin-form-success" role="status">
          <CheckCircle size={14} />
          <span>{notice}</span>
        </div>
      )}

      <div className="admin-form-actions">
        <a
          className="btn-outline"
          href={`/api/admin/quotations/${quotationId}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          <FileText size={16} />
          Download PDF
        </a>
        <a
          className="btn-outline"
          href={`/admin/quotations/${quotationId}/email-preview`}
        >
          <Eye size={16} />
          Email preview
        </a>
        <button className="btn-outline" type="button" onClick={sendEmail} disabled={busy}>
          <Mail size={16} />
          Email customer
        </button>
        <button className="btn-outline" type="button" onClick={() => setShowConvert((v) => !v)} disabled={busy}>
          <ShoppingCart size={16} />
          Convert to order
        </button>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="q-status">
          Status
        </label>
        <div className="admin-status-select">
          <select
            id="q-status"
            className="admin-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
          <button
            className="admin-status-btn"
            type="button"
            disabled={busy || status === currentStatus}
            onClick={() => changeStatus(status)}
          >
            {busy ? "Saving…" : "Update"}
          </button>
        </div>
      </div>

      <div className="admin-form-section">
        <h3 className="admin-form-section-title">Add product line</h3>
        <div className="admin-field">
          <label className="admin-label" htmlFor="q-product-search">
            Search catalogue
          </label>
          <div className="admin-status-select">
            <input
              id="q-product-search"
              className="admin-input"
              placeholder="Type a product name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchProducts();
                }
              }}
            />
            <button className="admin-status-btn" type="button" onClick={searchProducts} disabled={busy}>
              <RefreshCw size={14} />
            </button>
          </div>
          {options.length > 0 && (
            <div className="admin-notes-list" style={{ marginTop: 8 }}>
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="admin-note"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => {
                    setPicked(option);
                    setUnitPrice((option.price_cents / 100).toFixed(2));
                    setOptions([]);
                  }}
                >
                  <span className="admin-note-author">{option.title}</span>
                  <span className="admin-muted"> /{option.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <div className="admin-field">
            <label className="admin-label">
              Selected: <strong>{picked.title}</strong>
            </label>
            <div className="admin-status-select">
              <input
                className="admin-input"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
                aria-label="Quantity"
              />
              <input
                className="admin-input"
                type="number"
                min={0}
                step={0.01}
                placeholder="Unit price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                aria-label="Unit price"
              />
              <button className="admin-status-btn" type="button" onClick={addLine} disabled={busy}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        )}

        {lines.length > 0 && (
          <div className="admin-notes-list">
            {lines.map((line) => (
              <div key={line.id} className="admin-note" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>
                  {line.title} <span className="admin-muted">× {line.qty}</span>
                </span>
                <button
                  className="admin-action-btn"
                  type="button"
                  title="Remove line"
                  disabled={busy}
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConvert && (
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">Convert to order (no payment is taken)</h3>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-first">First name</label>
            <input id="cv-first" className="admin-input" required value={convert.customerFirstName}
              onChange={(e) => setConvert((p) => ({ ...p, customerFirstName: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-last">Last name</label>
            <input id="cv-last" className="admin-input" required value={convert.customerLastName}
              onChange={(e) => setConvert((p) => ({ ...p, customerLastName: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-email">Email</label>
            <input id="cv-email" type="email" className="admin-input" required value={convert.customerEmail}
              onChange={(e) => setConvert((p) => ({ ...p, customerEmail: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-phone">Phone</label>
            <input id="cv-phone" className="admin-input" required value={convert.customerPhone}
              onChange={(e) => setConvert((p) => ({ ...p, customerPhone: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-address">Address</label>
            <input id="cv-address" className="admin-input" required value={convert.customerAddress}
              onChange={(e) => setConvert((p) => ({ ...p, customerAddress: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-city">City</label>
            <input id="cv-city" className="admin-input" required value={convert.customerCity}
              onChange={(e) => setConvert((p) => ({ ...p, customerCity: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-postal">Postal code</label>
            <input id="cv-postal" className="admin-input" required value={convert.customerPostal}
              onChange={(e) => setConvert((p) => ({ ...p, customerPostal: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-country">Country</label>
            <input id="cv-country" className="admin-input" required value={convert.customerCountry}
              onChange={(e) => setConvert((p) => ({ ...p, customerCountry: e.target.value }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-delivery">Delivery</label>
            <select id="cv-delivery" className="admin-select" value={convert.delivery}
              onChange={(e) => setConvert((p) => ({ ...p, delivery: e.target.value }))}>
              <option value="standard">Standard</option>
              <option value="express">Express</option>
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="cv-payment">Payment</label>
            <select id="cv-payment" className="admin-select" value={convert.payment}
              onChange={(e) => setConvert((p) => ({ ...p, payment: e.target.value }))}>
              <option value="invoice">Invoice</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div className="admin-form-actions">
            <button className="btn-dark" type="button" onClick={convertToOrder} disabled={busy}>
              {busy ? "Converting…" : "Create order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}