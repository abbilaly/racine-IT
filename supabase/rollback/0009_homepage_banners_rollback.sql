-- 0009_homepage_banners_rollback.sql
-- Manual psql only. Restores the pre-0009 state: the storefront falls back to
-- its built-in hero slides when the table is absent.

BEGIN;

DROP TABLE IF EXISTS public.homepage_banners;

COMMIT;
