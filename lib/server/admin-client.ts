/**
 * AdminClient is the Supabase client used by admin data helpers after the
 * session has been validated server-side.
 *
 * We intentionally keep this as a lightweight alias so the admin layers do
 * not depend on a hard-coded Supabase generated type package.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AdminClient = SupabaseClient;
