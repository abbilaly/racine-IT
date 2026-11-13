import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listEmailLogs, EMAIL_KINDS } from "@/lib/server/email-center";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The server is not configured.",
      500
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const provider = url.searchParams.get("provider");
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? "50", 10)));

  if (kind && !EMAIL_KINDS.includes(kind as (typeof EMAIL_KINDS)[number])) {
    return fail(
      `kind must be one of: ${EMAIL_KINDS.join(", ")}.`,
      400
    );
  }

  try {
    const { rows, total } = await listEmailLogs(db, {
      q: q ?? undefined,
      kind: kind ?? undefined,
      status: status ?? undefined,
      provider: provider ?? undefined,
      page,
      limit,
    });

    return NextResponse.json({
      rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load email history.",
      500
    );
  }
}
