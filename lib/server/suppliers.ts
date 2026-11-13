import type { AdminClient } from "@/lib/server/admin-client";

/**
 * Supplier records and synchronization logs.
 *
 * These tables are created by supabase/migrations/0003_suppliers.sql.
 * Supplier availability is tracked separately from physical inventory and no
 * supplier API is called here — synchronization always goes through the CSV
 * preview workflow until real credentials and documentation exist.
 */

export type SupplierRow = {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  enabled: boolean;
  last_sync_at: string | null;
};

export type SupplierSyncLogRow = {
  id: string;
  supplier_id: string;
  status: string;
  message: string;
  rows_processed: number;
  rows_failed: number;
  started_at: string;
  ended_at: string;
  created_at: string;
};

const SUPPLIER_COLUMNS =
  "id, name, slug, contact_name, email, phone, website, notes, enabled, last_sync_at";

export async function createSupplier(
  db: AdminClient,
  input: {
    name: string;
    slug: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
  }
): Promise<SupplierRow> {
  const { data, error } = await db
    .from("suppliers")
    .insert({
      name: input.name,
      slug: input.slug,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
      enabled: true
    })
    .select(SUPPLIER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as SupplierRow;
}

export async function updateSupplier(
  db: AdminClient,
  id: string,
  input: {
    name?: string;
    slug?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    enabled?: boolean;
  }
): Promise<SupplierRow> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.contactName !== undefined) patch.contact_name = input.contactName || null;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");

  const { data, error } = await db
    .from("suppliers")
    .update(patch)
    .eq("id", id)
    .select(SUPPLIER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Supplier not found.");
  return data as SupplierRow;
}

export async function deleteSupplier(db: AdminClient, id: string): Promise<void> {
  const { error } = await db.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function logSyncAttempt(
  db: AdminClient,
  input: {
    supplierId: string;
    status: "success" | "partial" | "failed";
    message: string;
    rowsProcessed: number;
    rowsFailed: number;
    startedAt: string;
    endedAt: string;
  }
): Promise<SupplierSyncLogRow> {
  const { data, error } = await db
    .from("supplier_sync_logs")
    .insert({
      supplier_id: input.supplierId,
      status: input.status,
      message: input.message,
      rows_processed: input.rowsProcessed,
      rows_failed: input.rowsFailed,
      started_at: input.startedAt,
      ended_at: input.endedAt
    })
    .select(
      "id, supplier_id, status, message, rows_processed, rows_failed, started_at, ended_at, created_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return data as SupplierSyncLogRow;
}

export async function listSupplierSyncLogs(
  db: AdminClient,
  supplierId?: string | null,
  limit = 50
): Promise<SupplierSyncLogRow[]> {
  let query = db
    .from("supplier_sync_logs")
    .select(
      "id, supplier_id, status, message, rows_processed, rows_failed, started_at, ended_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierSyncLogRow[];
}