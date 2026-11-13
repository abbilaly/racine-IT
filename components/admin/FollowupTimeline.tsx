import type { FollowupJob } from "@/lib/server/email-center";

export interface FollowupTimelineProps {
  jobs: FollowupJob[];
  targetRef?: string;
}

export function FollowupTimeline({ jobs, targetRef }: FollowupTimelineProps) {
  if (jobs.length === 0) {
    return (
      <div className="followup-timeline-empty">
        <p>
          {targetRef ? `No follow-up jobs for ${targetRef}.` : "No follow-up jobs."}
        </p>
      </div>
    );
  }

  return (
    <ol className="followup-timeline">
      {jobs.map((job) => (
        <li key={job.id} className={`followup-timeline-item followup-timeline-item--${job.status}`}>
          <div className="followup-timeline-dot" />
          <div className="followup-timeline-content">
            <div className="followup-timeline-head">
              <span className="followup-timeline-status">{job.status}</span>
              {job.scheduledAt ? (
                <time className="followup-timeline-time" dateTime={job.scheduledAt}>
                  {formatDateTime(job.scheduledAt)}
                </time>
              ) : null}
            </div>
            <div className="followup-timeline-body">
              <div className="followup-timeline-subject">{job.subject}</div>
              {job.error ? (
                <div className="followup-timeline-error" title={job.error}>
                  {job.error}
                </div>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
