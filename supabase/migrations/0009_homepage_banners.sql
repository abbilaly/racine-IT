-- 0009_homepage_banners.sql
-- Owner-managed homepage hero banners.
--
-- STATUS: PREPARED, NOT APPLIED. Apply only with explicit owner approval.
--
-- SAFETY
--   * Additive only: one new table, no existing table, row or policy is changed.
--   * Idempotent: table, indexes and policies use IF NOT EXISTS / DROP POLICY IF EXISTS.
--   * The storefront keeps its built-in slides when this table is absent or empty,
--     so applying this migration is not required for the site to keep working.
--
-- ROLLBACK: supabase/rollback/0009_homepage_banners_rollback.sql (manual psql only)

BEGIN;

CREATE TABLE IF NOT EXISTS public.homepage_banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  subtitle    text NOT NULL DEFAULT '',
  kicker      text NOT NULL DEFAULT '',
  image_path  text NOT NULL CHECK (length(image_path) BETWEEN 1 AND 500),
  cta_label   text NOT NULL DEFAULT 'Shop now',
  cta_href    text NOT NULL DEFAULT '/shop',
  is_active   boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_banners_active_idx
  ON public.homepage_banners (is_active, position);

DROP TRIGGER IF EXISTS homepage_banners_set_updated_at ON public.homepage_banners;
CREATE TRIGGER homepage_banners_set_updated_at
  BEFORE UPDATE ON public.homepage_banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active homepage banners" ON public.homepage_banners;
CREATE POLICY "public read active homepage banners" ON public.homepage_banners
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admins read homepage banners" ON public.homepage_banners;
CREATE POLICY "admins read homepage banners" ON public.homepage_banners
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admins write homepage banners" ON public.homepage_banners;
CREATE POLICY "admins write homepage banners" ON public.homepage_banners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;
