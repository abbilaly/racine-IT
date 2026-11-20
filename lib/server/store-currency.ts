import { cache } from "react";
import { DEFAULT_CURRENCY, normaliseCurrency } from "@/lib/currency";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * The currency the live store is priced in (`store_settings.currency`).
 *
 * Server-rendered pages need it to format money the same way the storefront
 * does. It is read once per request and falls back to the offline demo
 * currency when Supabase is not configured, so admin and order screens keep
 * working in a local checkout without credentials.
 */
export const getStoreCurrency = cache(async (): Promise<string> => {
  const supabase = getServiceClient();
  if (!supabase) return DEFAULT_CURRENCY;

  const { data, error } = await supabase
    .from("store_settings")
    .select("currency")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return DEFAULT_CURRENCY;
  return normaliseCurrency((data as { currency?: string | null }).currency);
});
