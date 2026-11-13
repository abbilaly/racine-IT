import type { CampaignDraft } from "./CampaignForm";

export interface CampaignReviewProps {
  draft: CampaignDraft;
  onEdit: () => void;
  onSend: () => void;
  onCancel: () => void;
}

export function CampaignReview({ draft, onEdit, onSend, onCancel }: CampaignReviewProps) {
  const isTest = draft.recipientSelection === "test";
  const isManual = draft.recipientSelection === "manual";
  const recipients = draft.manualRecipients ?? [];

  return (
    <div className="campaign-review">
      <div className="campaign-review-head">
        <h1>Review campaign before sending</h1>
        <p>Confirm recipients, subject, and body before sending.</p>
      </div>
      <div className="campaign-review-warning">
        <strong>Caution:</strong>
        {isTest
          ? "This campaign can only be sent to the configured test recipient."
          : "Do not send to real customers without explicit approval."}
      </div>
      <div className="campaign-review-sections">
        <div className="campaign-review-section">
          <h2>Recipients</h2>
          {isTest ? (
            <div className="campaign-review-line">
              <span>Test recipient</span>
              <span className="campaign-review-value">{draft.testRecipient || "Not configured"}</span>
            </div>
          ) : isManual ? (
            <>
              <div className="campaign-review-line">
                <span>{recipients.length} {recipients.length === 1 ? "recipient" : "recipients"}</span>
              </div>
              {recipients.map((email, index) => (
                <div key={index} className="campaign-review-recipient">
                  {email}
                </div>
              ))}
            </>
          ) : (
            <div className="campaign-review-line">
              <span>Recipient mode</span>
              <span className="campaign-review-value">Planned for a future release</span>
            </div>
          )}
        </div>
        <div className="campaign-review-section">
          <h2>Message</h2>
          <div className="campaign-review-grid">
            <div className="campaign-review-cell">
              <span className="campaign-review-label">Subject</span>
              <span className="campaign-review-value">{draft.subject}</span>
            </div>
            <div className="campaign-review-cell">
              <span className="campaign-review-label">Kind</span>
              <span className="campaign-review-badge">{draft.kind}</span>
            </div>
            <div className="campaign-review-cell campaign-review-body-cell">
              <span className="campaign-review-label">Body preview</span>
              <div className="campaign-review-body" dangerouslySetInnerHTML={{ __html: draft.html }} />
            </div>
          </div>
        </div>
      </div>
      <div className="campaign-review-actions">
        <button type="button" className="campaign-button campaign-button--secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="campaign-button campaign-button--secondary" onClick={onEdit}>Edit</button>
        <button type="button" className="campaign-button campaign-button--primary" onClick={onSend}>Send campaign</button>
      </div>
    </div>
  );
}
