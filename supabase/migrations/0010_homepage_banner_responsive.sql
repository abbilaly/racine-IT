-- 0010_homepage_banner_responsive.sql
-- Responsive homepage banners: a dedicated mobile image and per-breakpoint
-- focal points, so a desktop composition is never blindly reused on a phone.
--
-- STATUS: PREPARED, NOT APPLIED. Apply only with explicit owner approval,
-- after 0009_homepage_banners.sql is applied.
--
-- SAFETY
--   * Additive only: three nullable/defaulted columns on a table this store
--     already ships, plus one NOT VALID check constraint. No row is deleted or
--     rewritten, and no policy, index or existing column is changed.
--   * Idempotent: IF NOT EXISTS everywhere and the constraint is guarded.
--   * The storefront and the admin both degrade to the 0009 single-image
--     behaviour when these columns are absent, so applying this migration is
--     never required for the site to keep working.
--
-- ROLLBACK (manual psql only):
--   ALTER TABLE public.homepage_banners
--     DROP CONSTRAINT IF EXISTS homepage_banners_focus_desktop_check,
--     DROP CONSTRAINT IF EXISTS homepage_banners_focus_mobile_check,
--     DROP COLUMN IF EXISTS focus_mobile,
--     DROP COLUMN IF EXISTS focus_desktop,
--     DROP COLUMN IF EXISTS mobile_image_path;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.homepage_banners') IS NULL THEN
    RAISE EXCEPTION 'migration 0010 requires migration 0009_homepage_banners.sql (homepage_banners is missing). Apply and verify 0009 first.';
  END IF;
END $$;

ALTER TABLE public.homepage_banners
  ADD COLUMN IF NOT EXISTS mobile_image_path text,
  ADD COLUMN IF NOT EXISTS focus_desktop    text NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS focus_mobile     text NOT NULL DEFAULT 'center';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homepage_banners_focus_desktop_check'
      AND conrelid = 'public.homepage_banners'::regclass
  ) THEN
    ALTER TABLE public.homepage_banners
      ADD CONSTRAINT homepage_banners_focus_desktop_check
      CHECK (focus_desktop IN ('center', 'top', 'bottom', 'left', 'right')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homepage_banners_focus_mobile_check'
      AND conrelid = 'public.homepage_banners'::regclass
  ) THEN
    ALTER TABLE public.homepage_banners
      ADD CONSTRAINT homepage_banners_focus_mobile_check
      CHECK (focus_mobile IN ('center', 'top', 'bottom', 'left', 'right')) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.homepage_banners.mobile_image_path IS
  'Optional artwork shown below 768px. NULL reuses image_path with focus_mobile applied.';
COMMENT ON COLUMN public.homepage_banners.focus_desktop IS
  'CSS object-position for the desktop crop: center, top, bottom, left or right.';
COMMENT ON COLUMN public.homepage_banners.focus_mobile IS
  'CSS object-position for the mobile crop: center, top, bottom, left or right.';

COMMIT;
