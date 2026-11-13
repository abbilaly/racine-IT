"use client";

export type AdminBadgeStatusProps = { status: string };

export function AdminBadgeStatus({ status }: AdminBadgeStatusProps) {
  const variant =
    status === "delivered" || status === "active" || status === "accepted"
      ? "success"
      : status === "processing" || status === "pending" || status === "sent"
      ? "warning"
      : status === "cancelled" || status === "rejected" || status === "failed"
      ? "danger"
      : "default";
  return <span className={`admin-badge admin-badge--${variant}`}>{status}</span>;
}
