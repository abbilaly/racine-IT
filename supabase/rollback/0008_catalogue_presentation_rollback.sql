-- 0008_catalogue_presentation_rollback.sql
-- Manual rollback for 0008_catalogue_presentation.sql.
--
-- Run with psql as the database owner. NOT part of supabase/migrations, so
-- `supabase db push` / `db reset` never executes it.
--
-- This removes ONLY objects created by 0008. No product, category or brand row
-- is deleted: dropping the added columns discards presentation/provenance
-- values, and dropping brand_categories removes the association table. Take a
-- backup first: dropping these columns is irreversible without one.

BEGIN;

DROP TABLE IF EXISTS public.brand_categories;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_parent_not_self,
  DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;

DROP INDEX IF EXISTS public.categories_parent_idx;

ALTER TABLE public.categories
  DROP COLUMN IF EXISTS banner_path,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS icon,
  DROP COLUMN IF EXISTS parent_id;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS origin;

COMMIT;
