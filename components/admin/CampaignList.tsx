import type { CampaignDraft } from "@/components/admin/CampaignForm";

export interface CampaignListProps {
  onCreate: (draft?: CampaignDraft) => void;
  drafts?: Array<{ id: string; name: string; subject: string; status: string; created_at: string }>;
}

export function CampaignList({ onCreate, drafts = [] }: CampaignListProps) {
  return (
    <div className="campaign-list">
      <div className="campaign-list-head">
        <div>
          <h2>Campaign drafts</h2>
          <p>
            Drafts stay local until you review them. Sending is test-only: the server only
            accepts the configured test recipient.
          </p>
        </div>
      </div>

      {drafts.length > 0 ? (
        <div className="ec-kv">
          {drafts.map(draft => (
            <div key={draft.id} className="ec-kv-row">
              <span className="ec-kv-key">{draft.name}</span>
              <span className="ec-kv-value">
                {draft.subject} · <span className="admin-badge">{draft.status}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ec-empty">
          No saved campaign drafts. Create one to preview the message and its recipient
          selection before sending.
        </p>
      )}

      <div className="campaign-list-actions">
        <button type="button" className="campaign-button campaign-button--primary" onClick={() => onCreate()}>
          Create campaign
        </button>
      </div>
    </div>
  );
}
