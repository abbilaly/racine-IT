import type { CampaignDraft } from "@/components/admin/CampaignForm";

export type FollowupFormValues = {
  targetType: "quotation" | "order";
  targetId?: string;
  initialDelayDays: number;
  subject: string;
  html: string;
  name?: string;
  templateKind?: string;
};

export function createCampaignDraftFromForm
(
  values: {
    name?: string | null;
    kind?: string | null;
    subject?: string | null;
    html?: string | null;
    recipientSelection?: "test" | "manual" | null;
    testRecipient?: string | null;
    manualRecipients?: string[] | null;
    createdBy?: string | null;
  },
  sessionCreatedBy: string | null
): CampaignDraft {
  return {
    name: values.name ?? "",
    kind: (values.kind ?? "order_confirmation") as CampaignDraft["kind"],
    subject: values.subject ?? "",
    html: values.html ?? "",
    recipientSelection: (values.recipientSelection ?? "test") as CampaignDraft["recipientSelection"],
    testRecipient: values.testRecipient ?? undefined,
    manualRecipients: values.manualRecipients ?? undefined,
    status: "draft",
    createdBy: sessionCreatedBy ?? undefined,
    createdAt: new Date().toISOString(),
  };
}
