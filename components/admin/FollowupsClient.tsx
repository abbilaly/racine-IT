"use client";

import { useEffect, useState } from "react";
import type { FollowupRule } from "@/lib/server/email-center";
import { FollowupForm, type FollowupFormValues } from "@/components/admin/FollowupForm";
import { FollowupList } from "@/components/admin/FollowupList";

export function FollowupsClient() {
  const [rules, setRules] = useState<FollowupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/followups", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => ({}))) as {
          rules?: FollowupRule[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Failed to load follow-up rules.");
        if (!cancelled) setRules(data.rules ?? []);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load follow-up rules.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const applyAction = async (rule: FollowupRule, action: "pause" | "resume" | "cancel") => {
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/followups/${rule.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json().catch(() => ({}))) as FollowupRule & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "The rule could not be updated.");
      return;
    }
    setRules(previous => previous.map(item => (item.id === rule.id ? data : item)));
    setNotice(`Rule ${action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "resumed"}.`);
  };

  const createRule = async (values: FollowupFormValues) => {
    setError(null);
    setNotice(null);
    const response = await fetch("/api/admin/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => ({}))) as {
      rule?: FollowupRule;
      error?: string;
    };
    if (!response.ok || !data.rule) {
      setError(data.error ?? "The rule could not be created.");
      return;
    }
    setRules(previous => [data.rule as FollowupRule, ...previous]);
    setNotice("Rule created as a draft. Activate it before it can send anything.");
  };

  return (
    <div className="followups">
      {error ? (
        <div className="admin-error" role="alert">
          <strong>Follow-ups</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-page-section">
        <FollowupForm rule={null} onSave={createRule} onCancel={() => setNotice(null)} />
      </section>

      <section className="admin-page-section">
        <h2>Rules</h2>
        {loading ? (
          <p className="muted-note">Loading follow-up rules…</p>
        ) : (
          <FollowupList
            rules={rules}
            onPause={rule => void applyAction(rule, "pause")}
            onResume={rule => void applyAction(rule, "resume")}
            onCancel={rule => void applyAction(rule, "cancel")}
          />
        )}
      </section>
    </div>
  );
}
