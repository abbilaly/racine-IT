"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageSquarePlus, ShoppingBag, StickyNote } from "lucide-react";

export type CrmOrder = {
  id: string;
  ref: string;
  status: string;
  total: number;
  item_count: number;
  created_at: string;
};

export type CrmNote = {
  id: string;
  note: string;
  author_email: string | null;
  created_at: string;
};

export type CrmSegment = {
  label: string;
  /** Plain-language rule, shown so staff know why the label applies. */
  reason: string;
};

type TimelineEntry =
  | { kind: "order"; at: string; order: CrmOrder }
  | { kind: "note"; at: string; note: CrmNote };

/**
 * Customer CRM panel.
 *
 * Segments and the timeline are derived only from stored orders and internal
 * notes, and each segment states the rule that produced it. Nothing here is a
 * prediction or an invented score.
 */
export function CustomerCrm({
  email,
  initialNotes,
  orders,
  segments,
  currency
}: {
  email: string;
  initialNotes: CrmNote[];
  orders: CrmOrder[];
  segments: CrmSegment[];
  currency: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(value / 100);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [
      ...orders.map(order => ({ kind: "order" as const, at: order.created_at, order })),
      ...notes.map(note => ({ kind: "note" as const, at: note.created_at, note }))
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }, [orders, notes]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note: text })
      });
      const data = (await res.json().catch(() => ({}))) as CrmNote & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The note could not be saved.");
        return;
      }
      setNotes(current => [data, ...current]);
      setText("");
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Segmentation</h2>
          <span className="text-[11px] text-muted-foreground">Derived from stored orders</span>
        </div>

        {segments.length === 0 ? (
          <p className="m-0 text-[12px] text-muted-foreground">
            No segment applies yet — this customer has no non-cancelled orders.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {segments.map(segment => (
              <li
                key={segment.label}
                className="rounded-full border border-border bg-muted px-3 py-1 text-[12px] font-medium text-foreground"
                title={segment.reason}
              >
                {segment.label}
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{segment.reason}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addNote} className="mt-4 flex flex-col gap-2">
          <label htmlFor="crm-note" className="text-[12px] font-medium text-foreground">
            Internal note
          </label>
          <textarea
            id="crm-note"
            value={text}
            onChange={event => setText(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Context for the next person handling this customer…"
            className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <MessageSquarePlus size={13} aria-hidden="true" />
              {busy ? "Saving…" : "Add note"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              Only visible to administrators.
            </span>
          </div>
          {error && (
            <p role="alert" className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[12px] text-destructive">
              {error}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Activity timeline</h2>
          <span className="text-[11px] text-muted-foreground">{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
        </div>

        {timeline.length === 0 ? (
          <p className="m-0 text-[12px] text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {timeline.map(entry =>
              entry.kind === "order" ? (
                <li key={`order-${entry.order.id}`} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <ShoppingBag size={12} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[12px] text-foreground">
                      Order{" "}
                      <Link href={`/admin/orders/${entry.order.id}`} className="font-medium underline">
                        {entry.order.ref}
                      </Link>{" "}
                      · {entry.order.status} · {money(entry.order.total)}
                    </p>
                    <p className="m-0 text-[11px] text-muted-foreground">
                      {new Date(entry.at).toLocaleString()} · {entry.order.item_count} item
                      {entry.order.item_count === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ) : (
                <li key={`note-${entry.note.id}`} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <StickyNote size={12} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 whitespace-pre-line break-words text-[12px] text-foreground">
                      {entry.note.note}
                    </p>
                    <p className="m-0 text-[11px] text-muted-foreground">
                      Internal note · {new Date(entry.at).toLocaleString()}
                      {entry.note.author_email ? ` · ${entry.note.author_email}` : ""}
                    </p>
                  </div>
                </li>
              )
            )}
          </ol>
        )}
      </section>
    </div>
  );
}
