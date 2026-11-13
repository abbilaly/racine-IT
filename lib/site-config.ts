/**
 * Central configuration for the AB Tech storefront.
 *
 * ⚠️ TEMPORARY VALUES — every contact detail below is a development / preview
 * placeholder. It is NOT a verified AB Tech business contact and must be
 * replaced (or moved to environment-backed settings) before launch.
 * Placeholders use reserved example domains and fictional phone ranges so they
 * can never reach a real person.
 */

/** Exact brand name shown across the storefront. */
export const BRAND = "AB Tech";

export const CONTACT = {
  /** TEMPORARY placeholder support email — replace before launch. */
  email: "support@abtech.example",
  /** TEMPORARY placeholder support phone — replace before launch. */
  phone: "+1 (555) 010-0000",
  /** Shown next to the placeholders so they are never read as verified details. */
  disclaimer:
    "Preview contact details — temporary placeholders, subject to change before launch.",
} as const;

/**
 * Email Center / follow-up screens are built on tables that only exist after
 * `supabase/migrations/0005_email_center.sql` (email_events, followup_rules,
 * followup_jobs, email_suppressions). That migration is deliberately NOT
 * applied, so the admin navigation for those screens is hidden and the routes
 * redirect back to the dashboard instead of failing on missing tables.
 *
 * Set to `true` only after 0005 is applied and verified in the target database.
 */
export const EMAIL_CENTER_ENABLED = false;

/** Short, honest storefront copy that makes no unverifiable claims. */
export const STORE_BLURB =
  "AB Tech is an online electronics store for phones, laptops, tablets, audio and wearables.";