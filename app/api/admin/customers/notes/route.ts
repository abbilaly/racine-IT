import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { createAdminNote, listAdminNotes } from "@/lib/server/admin-data";

/**
 * Internal customer notes.
 *
 * Stored in the existing `admin_notes` table under subject_type "customers",
 * keyed by the customer email — the same identifier the CRM lists customers by.
 * Admin-only; nothing here is exposed to the storefront.
 */
function emailFrom(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = emailFrom(new URL(request.url).searchParams.get("email"));
  if (!email) return NextResponse.json({ error: "Customer email is required." }, { status: 400 });

  const db = getAdminClient(session);
  try {
    const { rows, total } = await listAdminNotes(db, "customers", email, { page: 1, limit: 100 });
    return NextResponse.json({ notes: rows, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load notes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = emailFrom(typeof body.email === "string" ? body.email : "");
  if (!email) return NextResponse.json({ error: "Customer email is required." }, { status: 400 });
  if (typeof body.note !== "string" || body.note.trim().length === 0) {
    return NextResponse.json({ error: "Note is required." }, { status: 400 });
  }

  const db = getAdminClient(session);
  try {
    const note = await createAdminNote(db, session, {
      subject_type: "customers",
      subject_id: email,
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
