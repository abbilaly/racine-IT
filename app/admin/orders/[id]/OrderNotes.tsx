"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, AlertCircle } from "lucide-react";
import { AdminEmptyState } from "@/lib/server/admin-ui";

interface OrderNotesProps {
  orderId: string;
  notes?: Array<{
    id: string;
    note: string;
    created_at: string;
    author?: string;
  }>;
}

export function OrderNotes({ orderId, notes = [] }: OrderNotesProps) {
  const router = useRouter();
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote.trim() }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Could not add note.");
        setSaving(false);
        return;
      }

      setAdded(true);
      setNewNote("");
      router.refresh();
      setTimeout(() => setAdded(false), 3000);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="admin-notes">
      <form onSubmit={handleSubmit} className="admin-note-form">
        <div className="admin-note-input-wrap">
          <label htmlFor={`note-${orderId}`} className="admin-label">
            Add note
          </label>
          <textarea
            id={`note-${orderId}`}
            className="admin-textarea"
            rows={2}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write an internal note…"
            maxLength={1000}
          />
        </div>
        <div className="admin-note-actions">
          <button
            type="submit"
            className="btn-dark btn-dark--sm"
            disabled={saving || !newNote.trim()}
          >
            {saving ? "Saving…" : <><Plus size={14} /> Add note</>}
          </button>
          {added && (
            <span className="admin-note-added" role="status">
              <FileText size={14} />
              Note added.
            </span>
          )}
        </div>
        {error && (
          <div className="admin-form-error" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </form>

      {notes.length > 0 ? (
        <div className="admin-notes-list">
          {notes.map((note) => (
            <div key={note.id} className="admin-note">
              <div className="admin-note-header">
                <span className="admin-note-author">{note.author || "Admin"}</span>
                <span className="admin-note-date">{new Date(note.created_at).toLocaleString()}</span>
              </div>
              <p className="admin-note-body">{note.note}</p>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<FileText size={24} />}
          title="No notes yet"
          description="Notes appear here once added."
        />
      )}
    </div>
  );
}
