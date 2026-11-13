"use client";

import { useState } from "react";
import Link from "next/link";
import { EMAIL_KINDS, type EmailKind } from "@/lib/server/email-center";

const KIND_LABELS: Record<EmailKind, string> = {
  order_confirmation: "Order confirmation",
  order_status: "Order status",
  quotation: "Quotation",
  admin_notification: "Admin notification",
};

export function SendTestEmailForm({ defaultRecipient }: { defaultRecipient: string }) {
  const [to, setTo] = useState(defaultRecipient);
  const [subject, setSubject] = useState("AB Tech test email");
  const [html, setHtml] = useState("<p>This is a test message.</p>");
  const [kind, setKind] = useState<EmailKind>("admin_notification");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html, kind }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        provider_message_id?: string;
        log_id?: string;
      };
      if (response.ok && data.ok) {
        setResult({
          ok: true,
          text: `Resend accepted the message (id ${data.provider_message_id ?? "unknown"}, log ${
            data.log_id ?? "unknown"
          }). Acceptance is not proof of inbox delivery; check the history page for provider events.`,
        });
      } else {
        setResult({ ok: false, text: data.error ?? `Send failed with HTTP ${response.status}.` });
      }
    } catch (cause) {
      setResult({
        ok: false,
        text: cause instanceof Error ? cause.message : "The request failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="send-test-form"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="admin-field">
        <label className="admin-label" htmlFor="ec-test-to">
          Recipient
        </label>
        <input
          id="ec-test-to"
          className="admin-input"
          type="email"
          value={to}
          onChange={event => setTo(event.target.value)}
          placeholder="test@example.com"
          inputMode="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="ec-test-subject">
          Subject
        </label>
        <input
          id="ec-test-subject"
          className="admin-input"
          type="text"
          value={subject}
          onChange={event => setSubject(event.target.value)}
          maxLength={120}
          required
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="ec-test-type">
          Type
        </label>
        <select
          id="ec-test-type"
          className="admin-select"
          value={kind}
          onChange={event => setKind(event.target.value as EmailKind)}
        >
          {EMAIL_KINDS.map(item => (
            <option key={item} value={item}>
              {KIND_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field admin-field--wide">
        <label className="admin-label" htmlFor="ec-test-body">
          Body (HTML)
        </label>
        <textarea
          id="ec-test-body"
          className="admin-textarea"
          value={html}
          onChange={event => setHtml(event.target.value)}
          rows={8}
          maxLength={50_000}
          required
        />
      </div>

      {result ? (
        <div className={result.ok ? "admin-notice" : "admin-error"} role="status">
          <strong>{result.ok ? "Email accepted" : "Send failed"}</strong>
          <p>{result.text}</p>
        </div>
      ) : null}

      <div className="admin-form-actions">
        <button type="submit" className="btn-dark" disabled={busy}>
          {busy ? "Sending…" : "Send test email"}
        </button>
        <Link href="/admin/emails/history" className="btn-outline">
          Back to history
        </Link>
      </div>
    </form>
  );
}
