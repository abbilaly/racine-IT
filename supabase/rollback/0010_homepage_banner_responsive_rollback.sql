-- 0010_homepage_banner_responsive_rollback.sql
-- Manual psql only. Restores the pre-0010 banner schema.
--
-- SAFETY
--   * Removes only the three columns added by 0010 and their check constraints.
--   * No banner row is deleted: title, subtitle, image_path, CTA, visibility
--     and position are untouched, so every existing banner keeps displaying on
--     the storefront with its desktop image.
--   * Idempotent: IF EXISTS everywhere, so a re-run is a no-op.
--
-- DATA LOSS: the mobile image path and the two focal points are dropped with
-- their columns. Re-applying 0010 afterwards restores the columns with
-- 'center' defaults; the previously chosen values are not recovered, so take a
-- copy first if they matter:
--
--   CREATE TABLE public.homepage_banners_backup_0010 AS
--     SELECT id, mobile_image_path, focus_desktop, focus_mobile
--     FROM public.homepage_banners;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.homepage_banners') IS NULL THEN
    RAISE NOTICE 'homepage_banners does not exist; nothing to roll back.';
    RETURN;
  END IF;

  ALTER TABLE public.homepage_banners
    DROP CONSTRAINT IF EXISTS homepage_banners_focus_desktop_check,
    DROP CONSTRAINT IF EXISTS homepage_banners_focus_mobile_check,
    DROP COLUMN IF EXISTS focus_mobile,
    DROP COLUMN IF EXISTS focus_desktop,
    DROP COLUMN IF EXISTS mobile_image_path;
END $$;

COMMIT;
