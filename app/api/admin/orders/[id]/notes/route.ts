import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { listAdminNotes, createAdminNote } from "@/lib/server/admin-data";

/**
 * Internal order notes: GET lists them, POST adds one.
 * Notes are admin-only and stored under subject_type "orders".
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient(session);
  try {
    const { rows, total } = await listAdminNotes(db, "orders", id, { page: 1, limit: 100 });
    return NextResponse.json({ notes: rows, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load notes." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { note?: unknown };
  try {
    body = (await request.json()) as { note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.note !== "string" || body.note.trim().length === 0) {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }

  const db = getAdminClient(session);
  try {
    const note = await createAdminNote(db, session, {
      subject_type: "orders",
      subject_id: id,
      note: body.note
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add the note." },
      { status: 500 }
    );
  }
}