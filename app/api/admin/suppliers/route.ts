import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { createSupplier, updateSupplier, deleteSupplier, logSyncAttempt, listSupplierSyncLogs } from "@/lib/server/suppliers";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const supplierId = url.searchParams.get("supplierId");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  try {
    if (type === "logs") {
      const logs = await listSupplierSyncLogs(db, supplierId, limit);
      return NextResponse.json({ logs });
    }

    const rows = await db.from("suppliers").select("id, name, slug, contact_name, email, phone, website, notes, enabled, last_sync_at").order("name");
    return NextResponse.json({ suppliers: rows });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load suppliers.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  let body: { name?: unknown; slug?: unknown; contactName?: unknown; email?: unknown; phone?: unknown; website?: unknown; notes?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("The request body must be JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const website = typeof body.website === "string" ? body.website.trim() : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  if (!name) return fail("Supplier name is required.", 400);
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return fail("Slug is required and must be lowercase letters, digits and dashes.", 400);

  try {
    const row = await createSupplier(db, {
      name,
      slug,
      contactName,
      email,
      phone,
      website,
      notes,
    });
    return NextResponse.json({
      id: row.id,
      name: row.name,
      slug: row.slug,
      contact_name: row.contact_name,
      email: row.email,
      phone: row.phone,
      website: row.website,
      notes: row.notes,
      enabled: row.enabled,
      last_sync_at: row.last_sync_at,
    }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create supplier.", 500);
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const supplierId = url.searchParams.get("supplierId");
  const action = url.searchParams.get("action");

  try {
    if (action === "sync-status") {
      if (!supplierId) return fail("Supplier id is required.", 400);
      let body: { status?: unknown; message?: unknown; rowsProcessed?: unknown; rowsFailed?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return fail("The request body must be JSON.", 400);
      }

      const status = body.status === "success" || body.status === "partial" || body.status === "failed" ? body.status : "failed";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const rowsProcessed = typeof body.rowsProcessed === "number" ? body.rowsProcessed : 0;
      const rowsFailed = typeof body.rowsFailed === "number" ? body.rowsFailed : 0;
      const startedAt = new Date().toISOString();
      const endedAt = new Date().toISOString();

      const log = await logSyncAttempt(db, {
        supplierId,
        status,
        message,
        rowsProcessed,
        rowsFailed,
        startedAt,
        endedAt,
      });

      await db.from("suppliers").update({ last_sync_at: endedAt }).eq("id", supplierId);

      return NextResponse.json({
        log_id: log.id,
        status: log.status,
        message: log.message,
        rows_processed: log.rows_processed,
        rows_failed: log.rows_failed,
        started_at: log.started_at,
        ended_at: log.ended_at,
      });
    }

    if (!supplierId) return fail("Supplier id is required.", 400);
    let body: { name?: unknown; slug?: unknown; contactName?: unknown; email?: unknown; phone?: unknown; website?: unknown; notes?: unknown; enabled?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return fail("The request body must be JSON.", 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : undefined;
    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : undefined;
    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const website = typeof body.website === "string" ? body.website.trim() : undefined;
    const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
    const enabled = body.enabled === true || body.enabled === false ? body.enabled : undefined;

    const row = await updateSupplier(db, supplierId, {
      name,
      slug,
      contactName,
      email,
      phone,
      website,
      notes,
      enabled,
    });
    return NextResponse.json({
      id: row.id,
      name: row.name,
      slug: row.slug,
      contact_name: row.contact_name,
      email: row.email,
      phone: row.phone,
      website: row.website,
      notes: row.notes,
      enabled: row.enabled,
      last_sync_at: row.last_sync_at,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update supplier.", 500);
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient(session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The server is not configured.", 500);
  }

  const url = new URL(request.url);
  const supplierId = url.searchParams.get("supplierId");
  if (!supplierId) return fail("Supplier id is required.", 400);

  try {
    await deleteSupplier(db, supplierId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not delete supplier.", 500);
  }
}
