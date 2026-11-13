import type { AdminClient } from "@/lib/server/admin-client";

/**
 * Row shape of the single-row `store_settings` table. The table is maintained
 * by the store migration; typing it here keeps callers from depending on the
 * untyped Supabase client.
 */
export type StoreSettings = {
  store_name?: string | null;
  currency?: string | null;
  standard_shipping_cents?: number | null;
  express_shipping_cents?: number | null;
  checkout_enabled?: boolean | null;
  [key: string]: unknown;
};

type LooseClient = {
  from(table: string): {
    select(columns?: string): any;
    update(values: Record<string, unknown>): any;
  };
};

export async function getStoreSettings(db: AdminClient): Promise<StoreSettings | null> {
  const client = db as unknown as LooseClient;
  const { data, error } = await client
    .from("store_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as StoreSettings | null;
}

export async function patchStoreSettings(
  db: AdminClient,
  data: {
    storeName?: string;
    currency?: string;
    standardShipping?: number;
    expressShipping?: number;
    checkoutEnabled?: boolean;
  }
): Promise<StoreSettings | null> {
  const client = db as unknown as LooseClient;
  const { data: row, error } = await client
    .from("store_settings")
    .update(data)
    .eq("id", true)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (row ?? null) as StoreSettings | null;
}
