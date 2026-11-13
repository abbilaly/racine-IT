import type { FollowupRule } from "@/lib/server/email-center";

export interface FollowupListProps {
  rules: FollowupRule[];
  onEdit?: (rule: FollowupRule) => void;
  onPause?: (rule: FollowupRule) => void;
  onResume?: (rule: FollowupRule) => void;
  onCancel?: (rule: FollowupRule) => void;
}

export function FollowupList({
  rules,
  onEdit,
  onPause,
  onResume,
  onCancel,
}: FollowupListProps) {
  if (rules.length === 0) {
    return (
      <div className="followup-list-empty">
        <p>No follow-up rules yet.</p>
      </div>
    );
  }

  return (
    <div className="followup-list">
      {rules.map((rule) => (
        <div key={rule.id} className="followup-item">
          <div className="followup-item-main">
            <div className="followup-item-name">{rule.name ?? rule.id}</div>
            <div className="followup-item-meta">
              <span className="followup-item-target">
                {rule.targetType === "quotation" ? "Quotation" : "Order"}
                {rule.targetId ? ` · ${rule.targetId}` : ""}
              </span>
              <span className="followup-item-delay">
                {rule.initialDelayDays} day{rule.initialDelayDays === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="followup-item-status">
            <span className="followup-item-status-badge">{rule.status}</span>
            {rule.error ? (
              <span className="followup-item-error" title={rule.error}>
                {rule.error}
              </span>
            ) : null}
          </div>
          <div className="followup-item-actions">
            <button
              type="button"
              className="followup-action"
              onClick={() => onEdit?.(rule)}
            >
              Edit
            </button>
            {rule.status === "paused" && onResume ? (
              <button
                type="button"
                className="followup-action"
                onClick={() => onResume(rule)}
              >
                Resume
              </button>
            ) : rule.status === "active" && onPause ? (
              <button
                type="button"
                className="followup-action"
                onClick={() => onPause(rule)}
              >
                Pause
              </button>
            ) : null}
            {onCancel ? (
              <button
                type="button"
                className="followup-action followup-action--danger"
                onClick={() => onCancel(rule)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
