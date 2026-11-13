import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import {
  getFollowupRule,
  pauseFollowupRule,
  resumeFollowupRule,
  cancelFollowupRule,
} from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function ruleResponse(rule: NonNullable<Awaited<ReturnType<typeof getFollowupRule>>>) {
  return {
    id: rule.id,
    name: rule.name,
    targetType: rule.targetType,
    targetId: rule.targetId,
    initialDelayDays: rule.initialDelayDays,
    templateKind: rule.templateKind,
    subject: rule.subject,
    html: rule.html,
    status: rule.status,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    processedCount: rule.processedCount,
    error: rule.error,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await params;
  if (!id) return fail("Follow-up id is required.", 400);

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  try {
    const rule = await getFollowupRule(db, id);
    if (!rule) return fail("Follow-up rule not found.", 404);
    return NextResponse.json(ruleResponse(rule));
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load follow-up rule.",
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await params;
  if (!id) return fail("Follow-up id is required.", 400);

  let body: { action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const action = typeof body.action === "string" ? body.action : "";

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  try {
    if (action === "pause") {
      const rule = await pauseFollowupRule(db, id);
      return NextResponse.json(ruleResponse(rule));
    }
    if (action === "resume") {
      const rule = await resumeFollowupRule(db, id);
      return NextResponse.json(ruleResponse(rule));
    }
    if (action === "cancel") {
      const rule = await cancelFollowupRule(db, id);
      return NextResponse.json(ruleResponse(rule));
    }
    return fail('action must be "pause", "resume", or "cancel".', 400);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to update follow-up rule.",
      500
    );
  }
}

export const dynamic = "force-dynamic";
