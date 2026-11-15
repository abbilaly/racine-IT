-- 0008_catalogue_presentation.sql
-- Additive catalogue structure: category hierarchy + presentation fields,
-- brand/category associations, and product provenance.
--
-- STATUS: PREPARED, NOT APPLIED. It must be applied to production only after
-- the owner explicitly approves it, and after 0007_categories_taxonomy.sql is
-- applied and verified (0007 supplies categories.is_active and the approved
-- 14-category taxonomy this migration builds on).
--
-- SAFETY
--   * Additive only: no row is deleted, no column is dropped or rewritten.
--   * Idempotent: every column/table/index is IF NOT EXISTS and constraints are
--     added only when absent, so a re-run is a no-op.
--   * Existing product ids, category ids, positions, admin auth and RLS are
--     untouched. New columns are nullable, so existing rows remain valid.
--   * No category or product data is inserted here. Taxonomy rows come from
--     0007; subcategories and brand assignments are a separate, approved data
--     step because they must be grounded in the verified supplier catalogue.
--
-- ROLLBACK: supabase/rollback/0008_catalogue_presentation_rollback.sql
--   (manual psql only; that directory is not scanned by supabase db push).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'categories'
      AND column_name  = 'is_active'
  ) THEN
    RAISE EXCEPTION 'migration 0008 requires migration 0007_categories_taxonomy.sql (categories.is_active is missing). Apply and verify 0007 first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Category hierarchy and presentation
-- ---------------------------------------------------------------------------

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id   uuid,
  ADD COLUMN IF NOT EXISTS icon        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS banner_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_parent_id_fkey'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.categories (id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_parent_not_self'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    -- NOT VALID still enforces new writes; existing rows are untouched and
    -- NULL parents are valid, so validation is a later, optional step.
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_not_self
      CHECK (parent_id IS NULL OR parent_id <> id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categories_parent_idx ON public.categories (parent_id);

COMMENT ON COLUMN public.categories.parent_id IS
  'Parent category for subcategories. NULL = top-level category.';
COMMENT ON COLUMN public.categories.icon IS
  'Storefront icon key (for example laptop, printer, router). NULL = built-in default for the slug.';
COMMENT ON COLUMN public.categories.description IS
  'Short category blurb shown on the category landing page. NULL = built-in copy.';
COMMENT ON COLUMN public.categories.banner_path IS
  'Optional category banner image path. NULL = first product image in the category.';

-- ---------------------------------------------------------------------------
-- 2. Product provenance (origin is shown only when actually recorded)
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS origin     text,
  ADD COLUMN IF NOT EXISTS source_url text;

COMMENT ON COLUMN public.products.origin IS
  'Country of origin, only when documented by the supplier/manufacturer. Never inferred.';
COMMENT ON COLUMN public.products.source_url IS
  'Supplier or manufacturer page the catalogue data was verified against.';

-- ---------------------------------------------------------------------------
-- 3. Brand / category associations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brand_categories (
  brand_id    uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, category_id)
);

CREATE INDEX IF NOT EXISTS brand_categories_category_idx
  ON public.brand_categories (category_id);

ALTER TABLE public.brand_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read brand categories" ON public.brand_categories;
CREATE POLICY "public read brand categories" ON public.brand_categories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins write brand categories" ON public.brand_categories;
CREATE POLICY "admins write brand categories" ON public.brand_categories
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMENT ON TABLE public.brand_categories IS
  'Which brands are represented in which category. Drives the category brand showcase; empty until brand data is verified.';

COMMIT;
