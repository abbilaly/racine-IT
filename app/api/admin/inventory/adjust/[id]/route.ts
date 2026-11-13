import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listStockAdjustments } from "@/lib/server/admin-data";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  try {
    const { rows } = await listStockAdjustments(db, undefined, { page: 1, limit: 100 });
    const adjustment = rows.find((row) => row.id === id);
    if (!adjustment) return NextResponse.json({ adjustment: null });
    return NextResponse.json({ adjustment });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load adjustment.", 500);
  }
}
