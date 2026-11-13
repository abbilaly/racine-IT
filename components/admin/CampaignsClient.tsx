"use client";

import { useState } from "react";
import { CampaignForm, type CampaignDraft } from "@/components/admin/CampaignForm";
import { CampaignList } from "@/components/admin/CampaignList";
import { CampaignReview } from "@/components/admin/CampaignReview";
import { createCampaignDraftFromForm } from "@/lib/admin-ui";

export function CampaignsClient() {
  const [mode, setMode] = useState<"list" | "edit" | "review">("list");
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleSave = (values: CampaignDraft) => {
    const next = createCampaignDraftFromForm(values, null);
    const id = draft?.id ?? draftId ?? crypto.randomUUID();
    setDraft({ ...next, id });
    setDraftId(id);
    setMode("review");
  };

  const handleSend = async () => {
    if (!draft || !draftId) return;
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${draftId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind,
          subject: draft.subject,
          html: draft.html,
          recipientSelection: draft.recipientSelection,
          testRecipient: draft.testRecipient,
          manualRecipients: draft.manualRecipients,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        provider_message_id?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "The campaign could not be sent.");
        return;
      }
      setResult(
        `Resend accepted the message (id ${data.provider_message_id ?? "unknown"}). Acceptance is not proof of inbox delivery.`
      );
      setDraft(null);
      setDraftId(null);
      setMode("list");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The campaign could not be sent.");
    }
  };

  return (
    <div className="campaigns">
      {error ? (
        <div className="admin-error" role="alert">
          <strong>Campaign problem</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {result ? <p className="admin-notice">{result}</p> : null}

      {mode === "list" ? (
        <CampaignList
          onCreate={() => {
            setDraft(null);
            setDraftId(null);
            setMode("edit");
          }}
        />
      ) : null}

      {mode === "edit" ? (
        <CampaignForm
          draft={draft}
          onSave={handleSave}
          onCancel={() => setMode(draft ? "review" : "list")}
        />
      ) : null}

      {mode === "review" && draft ? (
        <CampaignReview
          draft={draft}
          onEdit={() => setMode("edit")}
          onSend={() => void handleSend()}
          onCancel={() => setMode("list")}
        />
      ) : null}

      {mode === "review" && !draft ? <p className="muted-note">No campaign draft open.</p> : null}
    </div>
  );
}
