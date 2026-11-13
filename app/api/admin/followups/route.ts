import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";
import {
  createFollowupRule,
  listFollowupRules,
  listFollowupJobs,
} from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  try {
    const db = adminClient(session);
    const rules = await listFollowupRules(db);
    const jobs = await listFollowupJobs(db, { limit: 100 });
    return NextResponse.json({ rules, jobs });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load follow-up rules.",
      500
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let body: {
    targetType?: unknown;
    targetId?: unknown;
    initialDelayDays?: unknown;
    templateKind?: unknown;
    subject?: unknown;
    html?: unknown;
    name?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const targetType = body.targetType === "order" ? "order" : body.targetType === "quotation" ? "quotation" : "";
  if (!targetType) return fail('targetType must be "quotation" or "order".', 400);

  const targetId =
    typeof body.targetId === "string" && body.targetId.trim() ? body.targetId.trim() : undefined;
  if (targetType === "order" && !targetId) {
    return fail("targetId is required for order follow-ups.", 400);
  }

  const initialDelayDays =
    typeof body.initialDelayDays === "number" ? body.initialDelayDays : Number(body.initialDelayDays);
  if (!Number.isFinite(initialDelayDays) || initialDelayDays < 1 || initialDelayDays > 90) {
    return fail("initialDelayDays must be between 1 and 90.", 400);
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const html = typeof body.html === "string" ? body.html.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateKind =
    typeof body.templateKind === "string" && body.templateKind.trim()
      ? body.templateKind.trim()
      : "quotation";

  if (!subject) return fail("subject is required.", 400);
  if (!html) return fail("html is required.", 400);
  if (subject.length > 120) return fail("subject must be 120 characters or fewer.", 400);
  if (html.length > 50_000) return fail("html must be 50000 characters or fewer.", 400);

  try {
    const rule = await createFollowupRule(adminClient(session), session.userId, {
      targetType,
      targetId,
      initialDelayDays,
      templateKind,
      subject,
      html,
      name: name || undefined,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to create the follow-up rule.",
      500
    );
  }
}

export const dynamic = "force-dynamic";
