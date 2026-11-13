"use client";

import { useRef } from "react";
import type { EmailMetrics } from "@/lib/server/email-center";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MousePointerClick,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger";

type Card = {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  icon: React.ReactNode;
};

function buildCards(metrics: EmailMetrics): Card[] {
  return [
    { key: "total", label: "Total", value: metrics.total, tone: "neutral", icon: <Mail size={14} /> },
    { key: "sent", label: "Sent", value: metrics.sent, tone: "neutral", icon: <Send size={14} /> },
    {
      key: "delivered",
      label: "Delivered",
      value: metrics.delivered,
      tone: "success",
      icon: <CheckCircle2 size={14} />,
    },
    { key: "opened", label: "Opened", value: metrics.opened, tone: "neutral", icon: <Eye size={14} /> },
    {
      key: "clicked",
      label: "Clicked",
      value: metrics.clicked,
      tone: "neutral",
      icon: <MousePointerClick size={14} />,
    },
    { key: "pending", label: "Pending", value: metrics.pending, tone: "warning", icon: <Clock size={14} /> },
    { key: "bounced", label: "Bounced", value: metrics.bounced, tone: "danger", icon: <XCircle size={14} /> },
    {
      key: "failed",
      label: "Failed",
      value: metrics.failed,
      tone: "danger",
      icon: <AlertTriangle size={14} />,
    },
    {
      key: "complained",
      label: "Complained",
      value: metrics.complained,
      tone: "danger",
      icon: <ShieldAlert size={14} />,
    },
  ];
}

const KIND_LABELS: Record<string, string> = {
  order_confirmation: "Order confirmation",
  order_status: "Order status",
  quotation: "Quotation",
  admin_notification: "Admin notification",
};

/**
 * Delivery counters. On phones and tablets the cards sit in a snap carousel
 * (about 1.6 cards visible, so the overflow is discoverable); from 1024px the
 * same cards become a grid and the carousel stops scrolling.
 */
export function EmailMetricsPanel({
  metrics,
  configured,
}: {
  metrics: EmailMetrics;
  configured: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = buildCards(metrics);

  const scrollByCard = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const first = node.firstElementChild as HTMLElement | null;
    const step = (first?.offsetWidth ?? 200) + 12;
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section className="ec-metrics" aria-label="Email delivery metrics">
      <div className="ec-summary">
        <div className="ec-summary-main">
          <span className="ec-summary-icon" aria-hidden="true">
            <Mail size={18} />
          </span>
          <div>
            <div className="ec-summary-value">{metrics.total.toLocaleString()}</div>
            <div className="ec-summary-label">Emails logged in the last 90 days</div>
          </div>
        </div>
        <span className={`ec-summary-state${configured ? " ec-summary-state--ok" : " ec-summary-state--warn"}`}>
          {configured ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {configured ? "Resend connected" : "Provider key missing"}
        </span>
      </div>

      <div
        ref={scroller}
        className="ec-metrics-scroller"
        role="group"
        aria-label="Delivery counters, scroll horizontally for more"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollByCard(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollByCard(-1);
          }
        }}
      >
        {cards.map(card => (
          <article key={card.key} className={`ec-metric ec-metric--${card.tone}`}>
            <div className="ec-metric-head">
              <span className="ec-metric-label">{card.label}</span>
              <span className="ec-metric-icon" aria-hidden="true">
                {card.icon}
              </span>
            </div>
            <div className="ec-metric-value">{card.value.toLocaleString()}</div>
            <span className="sr-only">{`${card.label}: ${card.value}`}</span>
          </article>
        ))}
      </div>

      <p className="ec-metrics-hint" aria-hidden="true">
        Swipe, scroll or use ← → to see more counters
      </p>

      {metrics.by_kind.length > 0 && (
        <div className="ec-section">
          <div className="ec-section-head">
            <h2>By email type</h2>
            <p>Counts from the same 90-day window</p>
          </div>
          <div className="ec-kv">
            {metrics.by_kind.map(row => (
              <div key={row.kind} className="ec-kv-row">
                <span className="ec-kv-key">{KIND_LABELS[row.kind] ?? row.kind}</span>
                <span className="ec-kv-value">
                  {row.sent.toLocaleString()} sent
                  {row.failed > 0 ? ` · ${row.failed.toLocaleString()} failed` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
