import type { CampaignDraft } from "./CampaignForm";

export interface CampaignAudienceProps {
  draft: Pick<CampaignDraft, "recipientSelection" | "testRecipient" | "manualRecipients">;
}

export function CampaignAudience({ draft }: CampaignAudienceProps) {
  const recipients = draft.manualRecipients ?? [];
  return (
    <div className="campaign-audience">
      <div className="campaign-audience-label">Recipient selection</div>
      {draft.recipientSelection === "test" ? (
        <div className="campaign-audience-value">
          Test recipient only
          {draft.testRecipient ? (
            <span className="campaign-audience-email">{draft.testRecipient}</span>
          ) : (
            <span className="campaign-audience-missing">Not configured</span>
          )}
        </div>
      ) : draft.recipientSelection === "manual" ? (
        <div className="campaign-audience-value">
          Manual recipients
          <span className="campaign-audience-count">
            {recipients.length} address{recipients.length === 1 ? "" : "es"}
          </span>
          {recipients.length === 0 && (
            <span className="campaign-audience-missing">No recipients added</span>
          )}
        </div>
      ) : (
        <div className="campaign-audience-value">
          All customers
          <span className="campaign-audience-missing">Planned for a future release</span>
        </div>
      )}
    </div>
  );
}
