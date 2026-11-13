-- 0007_categories_taxonomy.sql
-- Reorganize store categories into the approved 14-main-category taxonomy.
--
-- STRATEGY: REUSE IN PLACE (approved). No category row is deleted and no
-- product row is touched except its category_id:
--   * phones    (d68104ff-…) RELABELED -> smartphones / 'Smartphones & Tablets'
--   * laptops   (84d6206c-…) RELABELED -> computers   / 'Computers & Laptops'
--   * wearables (c69827ba-…) RELABELED -> 'Wearables & Smartwatches' (option C)
--   * tablets   (fd414ab7-…) and audio (5857c9ab-…) KEPT but DEACTIVATED
--     (is_active=false) in BOTH installation modes, and PARKED at positions
--     15 and 16 — after the active 1..14 range — so no position value is
--     shared with an active category.
--   * 11 brand-new active categories inserted
--   * products reassigned only where the old category no longer matches:
--       2 ipads  tablets  -> smartphones
--       3 audio  audio    -> multimedia
--     iphones/macbooks/watches need no change: their category row's identity
--     changed, the id did not.
--
-- NOT NULL note: categories.position is NOT NULL. Inactive rows keep a valid
-- integer position (15, 16); visibility is controlled by is_active alone, and
-- positions 1..14 belong exclusively to active categories.
--
-- INSTALLATION MODES (a `supabase db reset` runs migrations BEFORE seed.sql,
-- so the migration must handle an empty database without weakening any
-- production safeguard):
--   mode = 'production' : the exact verified 5-category snapshot (the live DB)
--   mode = 'fresh'      : 0 categories and 0 products
-- Anything else aborts with a clear exception instead of guessing.
-- Both paths converge on the SAME 16 rows (same ids, slugs, labels, positions,
-- active flags): 14 active + 2 inactive. Only created_at differs.
--
-- MODE RECORD: the resolved mode, baselines, timestamp and exact
--   pre-migration category snapshot are written to
--   public._migration_0007_state, which the rollback script READS and verifies
--   instead of its own compiled-in literals. It is RLS-enabled with no
--   policies and revoked from PUBLIC/anon/authenticated/service_role, so it is
--   invisible to the API while remaining queryable by an operator. The
--   rollback never guesses the mode; if the marker is missing it aborts.
--
-- ROLLBACK: supabase/rollback/0007_categories_taxonomy_rollback.sql
--   Run MANUALLY with psql. That directory is NOT scanned for migrations, so
--   `supabase db reset` / `supabase db push` can never apply it.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------

-- 0a. Must not already be applied (is_active is the marker column).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'categories'
      AND column_name  = 'is_active'
  ) THEN
    RAISE EXCEPTION 'migration 0007 precondition FAILED: categories.is_active already exists — migration already applied';
  END IF;

  -- Refuse to bury a previous partial attempt under a fresh marker table.
  IF to_regclass('public._migration_0007_state') IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 precondition FAILED: public._migration_0007_state already exists — a previous run left state behind; inspect and clean up before retrying';
  END IF;
END $$;

-- 0b. Durable mode + pre-migration snapshot record. Written exactly once, by
--     this migration, before anything is modified; read by the rollback, which
--     restores the rows recorded here instead of comparing against literals.
CREATE TABLE public._migration_0007_state (
  id                     boolean     PRIMARY KEY DEFAULT true CHECK (id),
  mode                   text        NOT NULL CHECK (mode IN ('production', 'fresh')),
  applied_at             timestamptz NOT NULL DEFAULT now(),
  categories_before      integer     NOT NULL CHECK (categories_before >= 0),
  products_before        integer     NOT NULL CHECK (products_before >= 0),
  active_products_before integer     NOT NULL CHECK (active_products_before >= 0),
  -- [{id, slug, label, position, created_at}] exactly as they were before this
  -- migration modified anything, ordered by id. created_at is canonical UTC text,
  -- so comparison does not depend on the session TimeZone.
  snapshot               jsonb       NOT NULL,
  snapshot_md5           text        NOT NULL CHECK (snapshot_md5 ~ '^[0-9a-f]{32}$'),
  CONSTRAINT _migration_0007_state_snapshot_shape CHECK (
    jsonb_typeof(snapshot) = 'array' AND (
      (
        mode = 'fresh'
        AND categories_before = 0
        AND products_before = 0
        AND active_products_before = 0
        AND snapshot = '[]'::jsonb
      )
      OR
      (
        mode = 'production'
        AND categories_before = 5
        AND jsonb_array_length(snapshot) = 5
      )
    )
  ),
  CONSTRAINT _migration_0007_state_snapshot_digest CHECK (snapshot_md5 = md5(snapshot::text))
);

COMMENT ON TABLE public._migration_0007_state IS
  'Mode and exact pre-migration category rows recorded by migration 0007. Write-once; read and verified by 0007_categories_taxonomy_rollback.sql, which drops it.';

-- Lock it down: no API access. Service role bypasses RLS; nobody else sees it,
-- so revoke it explicitly as well.
ALTER TABLE public._migration_0007_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._migration_0007_state FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._migration_0007_state FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._migration_0007_state FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._migration_0007_state FROM service_role';
  END IF;
END $$;

-- The record is write-once. An UPDATE, DELETE or TRUNCATE is either a bug or a
-- tamper attempt: the rollback only reads this table and then drops it.
CREATE OR REPLACE FUNCTION public._migration_0007_state_write_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'public._migration_0007_state is write-once (attempted %)', TG_OP;
END;
$$;
REVOKE ALL ON FUNCTION public._migration_0007_state_write_once() FROM PUBLIC;

DROP TRIGGER IF EXISTS _migration_0007_state_write_once ON public._migration_0007_state;
CREATE TRIGGER _migration_0007_state_write_once
  BEFORE UPDATE OR DELETE ON public._migration_0007_state
  FOR EACH ROW EXECUTE FUNCTION public._migration_0007_state_write_once();

DROP TRIGGER IF EXISTS _migration_0007_state_no_truncate ON public._migration_0007_state;
CREATE TRIGGER _migration_0007_state_no_truncate
  BEFORE TRUNCATE ON public._migration_0007_state
  FOR EACH STATEMENT EXECUTE FUNCTION public._migration_0007_state_write_once();

-- 0c. Resolve the mode, and capture the exact pre-migration category rows.
DO $$
DECLARE
  v_categories integer;
  v_products   integer;
  v_active     integer;
  v_src_ok     boolean;
  v_snapshot   jsonb;
BEGIN
  SELECT count(*) INTO v_categories FROM public.categories;
  SELECT count(*) INTO v_products   FROM public.products;
  SELECT count(*) INTO v_active     FROM public.products WHERE is_active = true;

  -- Captured here, before section 2/3 mutate anything, so this is the genuine
  -- pre-migration state of whichever database this ran against. created_at is
  -- stored as canonical UTC text; comparing a timestamptz as jsonb would render
  -- according to the session TimeZone.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',         c.id,
           'slug',       c.slug,
           'label',      c.label,
           'position',   c.position,
           'created_at', to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
         ) ORDER BY c.id), '[]'::jsonb)
    INTO v_snapshot
    FROM public.categories c;

  -- Fresh database: nothing exists yet (migrations run before seed.sql).
  IF v_categories = 0 AND v_products = 0 THEN
    INSERT INTO public._migration_0007_state
      (mode, categories_before, products_before, active_products_before, snapshot, snapshot_md5)
      VALUES ('fresh', 0, 0, 0, v_snapshot, md5(v_snapshot::text));
    RETURN;
  END IF;

  -- Production snapshot: exactly the 5 verified rows and nothing else. This gate
  -- deliberately ignores created_at, so a staging clone with different
  -- created_at values still qualifies.
  IF v_categories = 5 THEN
    SELECT bool_and(
      (id, slug, label, position) IN (
        ('d68104ff-a80e-4281-a8a1-8189cd423c2c', 'phones',    'Phones/Mobile',     0),
        ('84d6206c-c5f0-48ce-8bd6-f653e4a78ba7', 'laptops',   'Macbook/PCs',       1),
        ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed', 'tablets',   'Tablets/Ipad Pro',  2),
        ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d', 'audio',     'Audio/Headphones',  3),
        ('c69827ba-1c33-4dd6-993e-ecc34cca9702', 'wearables', 'Watches/Wearables', 4)
      )
    ) INTO v_src_ok
    FROM public.categories;

    IF NOT v_src_ok THEN
      RAISE EXCEPTION 'migration 0007 precondition FAILED: the 5 existing categories do not match the verified snapshot (id/slug/label/position)';
    END IF;

    INSERT INTO public._migration_0007_state
      (mode, categories_before, products_before, active_products_before, snapshot, snapshot_md5)
      VALUES ('production', v_categories, v_products, v_active, v_snapshot, md5(v_snapshot::text));
    RETURN;
  END IF;

  RAISE EXCEPTION
    'migration 0007 precondition FAILED: unexpected database state (% categories, % products). Expected either an empty database (fresh install) or the verified 5-category production snapshot. Refusing to guess.',
    v_categories, v_products;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Product guards (production mode only). These cover products of ANY
--    status, because an inactive product left on a deactivated category would
--    be invisible and unmanageable. Abort loudly rather than silently move or
--    orphan anything.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_mode text;
  v_bad  text;
BEGIN
  SELECT mode INTO v_mode FROM public._migration_0007_state;

  IF v_mode <> 'production' THEN
    RETURN;  -- fresh install: no products exist
  END IF;

  -- 1a. No NULL or unknown category_id.
  SELECT string_agg(format('%s (%s) -> category_id %s', p.slug, p.id, coalesce(p.category_id::text, 'NULL')), ', ')
    INTO v_bad
  FROM public.products p
  WHERE p.category_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: product(s) with a NULL or unknown category_id: %', v_bad;
  END IF;

  -- 1b. phones: only the 3 verified iphones (any status).
  SELECT string_agg(format('%s (%s, is_active=%s)', p.slug, p.id, p.is_active), ', ') INTO v_bad
  FROM public.products p
  WHERE p.category_id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c'
    AND p.slug NOT IN (
      'apple-iphone-13-mini-128gb-pink',
      'apple-iphone-13-mini-128gb-blue',
      'apple-iphone-13-mini-128gb-white');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: unexpected product(s) on category phones (any status): %', v_bad;
  END IF;

  -- 1c. laptops: only the 2 verified macbooks (any status).
  SELECT string_agg(format('%s (%s, is_active=%s)', p.slug, p.id, p.is_active), ', ') INTO v_bad
  FROM public.products p
  WHERE p.category_id = '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7'
    AND p.slug NOT IN ('macbook-pro-16-m3-gray-2025', 'macbook-pro-16-m2-gray');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: unexpected product(s) on category laptops (any status): %', v_bad;
  END IF;

  -- 1d. tablets: only the 2 verified ipads (any status).
  SELECT string_agg(format('%s (%s, is_active=%s)', p.slug, p.id, p.is_active), ', ') INTO v_bad
  FROM public.products p
  WHERE p.category_id = 'fd414ab7-0ef6-443f-a7f0-fb1a7234deed'
    AND p.slug NOT IN ('apple-ipad-pro-m1-12-inch-2022', 'apple-ipad-pro-m1-11-inch-2021');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: unexpected product(s) on category tablets (any status): %', v_bad;
  END IF;

  -- 1e. audio: only the 3 verified audio products (any status).
  SELECT string_agg(format('%s (%s, is_active=%s)', p.slug, p.id, p.is_active), ', ') INTO v_bad
  FROM public.products p
  WHERE p.category_id = '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d'
    AND p.slug NOT IN (
      'proove-wireless-headset-gaming-bliss',
      'apple-airpods-3-2022',
      'portable-wireless-speakers-2025');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: unexpected product(s) on category audio (any status): %', v_bad;
  END IF;

  -- 1f. The 12 verified products must each exist with the expected slug and
  --     source category (any status).
  SELECT string_agg(format('expected %s (%s) on %s, found %s', e.slug, e.id, e.category, coalesce(p.category_id::text, 'MISSING ROW')), ', ')
    INTO v_bad
  FROM (VALUES
    ('95a997e0-dc56-482b-b5fb-5d078af879af'::uuid, 'apple-iphone-13-mini-128gb-pink',        'phones'),
    ('4018ff4c-cd1a-4cb3-8704-f3b070363eb4'::uuid, 'apple-iphone-13-mini-128gb-blue',        'phones'),
    ('54407483-3351-4ecf-8321-9835aebad13d'::uuid, 'apple-iphone-13-mini-128gb-white',       'phones'),
    ('218ac2b1-221a-4b7e-bad8-b845b838286c'::uuid, 'macbook-pro-16-m3-gray-2025',            'laptops'),
    ('43a0b09a-3326-4d75-af06-0a8ba5b91534'::uuid, 'macbook-pro-16-m2-gray',                 'laptops'),
    ('264f6edc-9b3f-4e68-ae95-56e6ac83449b'::uuid, 'apple-ipad-pro-m1-12-inch-2022',         'tablets'),
    ('84844ee4-c36c-4384-9e2f-4c8a29e95103'::uuid, 'apple-ipad-pro-m1-11-inch-2021',         'tablets'),
    ('a3cd6b22-56b8-4fcc-b992-45be3047816e'::uuid, 'proove-wireless-headset-gaming-bliss',   'audio'),
    ('a951011f-7836-4af3-9ca2-1c7565c71159'::uuid, 'apple-airpods-3-2022',                   'audio'),
    ('36404303-9d88-4ad2-8558-c85759fbdd3a'::uuid, 'portable-wireless-speakers-2025',        'audio'),
    ('a4977f04-a1ea-424c-8da0-40adc8ef7c78'::uuid, 'apple-watch-aluminum-case-pride-edition','wearables'),
    ('694b5337-731b-4919-b539-865fff4d8d53'::uuid, 'valdus-round-smart-watch-blood-pressure', 'wearables')
  ) AS e(id, slug, category)
  LEFT JOIN public.products p ON p.id = e.id
  LEFT JOIN public.categories c ON c.slug = e.category
  WHERE p.id IS NULL OR p.category_id IS DISTINCT FROM c.id;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: verified product(s) missing or on an unexpected category: %', v_bad;
  END IF;

  -- 1g. Target slugs must be free, except for the 3 rows relabeled in step 3.
  SELECT string_agg(slug, ', ') INTO v_bad
  FROM public.categories
  WHERE slug IN ('computers','desktops','servers','networking','components',
                 'smartphones','gaming','printers','monitors','multimedia',
                 'peripherals','software','power','wearables')
    AND id NOT IN (
      'd68104ff-a80e-4281-a8a1-8189cd423c2c',
      '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7',
      'c69827ba-1c33-4dd6-993e-ecc34cca9702');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: target slug(s) already used by an unexpected row: %', v_bad;
  END IF;

  -- 1h. Target UUIDs must be free (idempotency).
  SELECT string_agg(id::text, ', ') INTO v_bad
  FROM public.categories
  WHERE id IN (
    '7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1',
    '0c0d1c35-2e2e-46d6-85a1-c15bf69c2f32',
    '3a7b6117-2a1d-4dc8-98e1-7fcc2fe4d829',
    '1d5c2bf8-4948-48d0-9e64-d32d87ed72a1',
    '1afa9181-d014-40a1-84b0-77b3b9d49c91',
    'dcc07a8b-ce35-4af8-86a1-eba2d5db7526',
    '115696d3-4e3b-4632-b6fb-d4f25352b798',
    '22e6f582-bd46-46c8-9542-19a87e74d2cc',
    '60f1fd6e-2227-498b-ae51-6f375e6e30b5',
    '43fdb502-c820-4e95-b610-8117bc582bb0',
    '1835d8f4-6514-4a1a-9011-b4a3789f7c98');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 guard FAILED: target category UUID(s) already exist: %', v_bad;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Schema: is_active (NOT NULL DEFAULT true). Existing rows start active;
--    position stays NOT NULL and no position is ever NULLed.
-- ---------------------------------------------------------------------------

ALTER TABLE public.categories
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 3. PRODUCTION PATH — relabel 3 rows in place, deactivate 2, insert 11 new,
--    move the 5 products whose category changed identity.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_mode     text;
  v_affected integer;
BEGIN
  SELECT mode INTO v_mode FROM public._migration_0007_state;

  IF v_mode = 'production' THEN

    -- 3a. Keep tablets + audio as INACTIVE and park them after the active
    --     range: tablets -> 15, audio -> 16. Their original positions (2, 3)
    --     are recorded here so the rollback can restore them exactly.
    UPDATE public.categories c
       SET is_active = false,
           position  = v.position
      FROM (VALUES
        ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed'::uuid, 15),   -- tablets (was 2)
        ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d'::uuid, 16)    -- audio   (was 3)
      ) AS v(id, position)
     WHERE c.id = v.id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 2 THEN
      RAISE EXCEPTION 'migration 0007 step 3a FAILED: deactivated/parked % rows, expected 2 (tablets, audio)', v_affected;
    END IF;

    -- 3b. phones -> smartphones, IN PLACE (same id, same created_at).
    UPDATE public.categories
       SET slug = 'smartphones', label = 'Smartphones & Tablets', position = 6
     WHERE id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'migration 0007 step 3b FAILED: relabeled % phones rows, expected 1', v_affected;
    END IF;

    -- 3c. laptops -> computers, IN PLACE.
    UPDATE public.categories
       SET slug = 'computers', label = 'Computers & Laptops', position = 1
     WHERE id = '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'migration 0007 step 3c FAILED: relabeled % laptops rows, expected 1', v_affected;
    END IF;

    -- 3d. wearables relabel, IN PLACE (option C: the 14th active category).
    UPDATE public.categories
       SET label = 'Wearables & Smartwatches', position = 7
     WHERE id = 'c69827ba-1c33-4dd6-993e-ecc34cca9702';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'migration 0007 step 3d FAILED: relabeled % wearables rows, expected 1', v_affected;
    END IF;

    -- 3e. The 11 new active categories.
    INSERT INTO public.categories (id, slug, label, position, is_active) VALUES
      ('0c0d1c35-2e2e-46d6-85a1-c15bf69c2f32', 'desktops',    'Desktop Computers',          2, true),
      ('3a7b6117-2a1d-4dc8-98e1-7fcc2fe4d829', 'servers',     'Servers',                    3, true),
      ('1d5c2bf8-4948-48d0-9e64-d32d87ed72a1', 'networking',  'Networking & Telecom',       4, true),
      ('1afa9181-d014-40a1-84b0-77b3b9d49c91', 'components',  'PC Components',              5, true),
      ('dcc07a8b-ce35-4af8-86a1-eba2d5db7526', 'gaming',      'Gaming',                     8, true),
      ('115696d3-4e3b-4632-b6fb-d4f25352b798', 'printers',    'Printers & Scanners',        9, true),
      ('22e6f582-bd46-46c8-9542-19a87e74d2cc', 'monitors',    'Monitors & Displays',       10, true),
      ('7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1', 'multimedia',  'Multimedia & Audio',        11, true),
      ('60f1fd6e-2227-498b-ae51-6f375e6e30b5', 'peripherals', 'Peripherals & Accessories', 12, true),
      ('43fdb502-c820-4e95-b610-8117bc582bb0', 'software',    'Software & Licenses',       13, true),
      ('1835d8f4-6514-4a1a-9011-b4a3789f7c98', 'power',       'UPS & Power',               14, true);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 11 THEN
      RAISE EXCEPTION 'migration 0007 step 3e FAILED: inserted % new categories, expected 11', v_affected;
    END IF;

    -- 3f. Move the products whose category changed identity. Guards 1b–1f proved
    --     the slug sets are exact, so these move every product of every status
    --     on those two categories and nothing else. All statuses covered: no
    --     `is_active` filter on purpose.
    UPDATE public.products
       SET category_id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c'   -- smartphones
     WHERE category_id = 'fd414ab7-0ef6-443f-a7f0-fb1a7234deed';  -- tablets
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 2 THEN
      RAISE EXCEPTION 'migration 0007 step 3f-1 FAILED: moved % tablet products, expected 2 (both ipads)', v_affected;
    END IF;

    UPDATE public.products
       SET category_id = '7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1'   -- multimedia
     WHERE category_id = '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d';  -- audio
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 3 THEN
      RAISE EXCEPTION 'migration 0007 step 3f-2 FAILED: moved % audio products, expected 3', v_affected;
    END IF;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. FRESH PATH — build the identical final rows from scratch, so a fresh
--    install and the production database converge on the same ids, slugs,
--    labels, positions and active flags. Tablets + audio are created INACTIVE
--    in this mode too, so both installations have exactly 16 rows
--    (14 active + 2 inactive) and every post-check below is unconditional.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_mode     text;
  v_affected integer;
BEGIN
  SELECT mode INTO v_mode FROM public._migration_0007_state;

  IF v_mode = 'fresh' THEN

    INSERT INTO public.categories (id, slug, label, position, is_active) VALUES
      -- 14 active, in the approved order
      ('84d6206c-c5f0-48ce-8bd6-f653e4a78ba7', 'computers',   'Computers & Laptops',        1, true),
      ('0c0d1c35-2e2e-46d6-85a1-c15bf69c2f32', 'desktops',    'Desktop Computers',          2, true),
      ('3a7b6117-2a1d-4dc8-98e1-7fcc2fe4d829', 'servers',     'Servers',                    3, true),
      ('1d5c2bf8-4948-48d0-9e64-d32d87ed72a1', 'networking',  'Networking & Telecom',       4, true),
      ('1afa9181-d014-40a1-84b0-77b3b9d49c91', 'components',  'PC Components',              5, true),
      ('d68104ff-a80e-4281-a8a1-8189cd423c2c', 'smartphones', 'Smartphones & Tablets',      6, true),
      ('c69827ba-1c33-4dd6-993e-ecc34cca9702', 'wearables',   'Wearables & Smartwatches',   7, true),
      ('dcc07a8b-ce35-4af8-86a1-eba2d5db7526', 'gaming',      'Gaming',                     8, true),
      ('115696d3-4e3b-4632-b6fb-d4f25352b798', 'printers',    'Printers & Scanners',        9, true),
      ('22e6f582-bd46-46c8-9542-19a87e74d2cc', 'monitors',    'Monitors & Displays',       10, true),
      ('7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1', 'multimedia',  'Multimedia & Audio',        11, true),
      ('60f1fd6e-2227-498b-ae51-6f375e6e30b5', 'peripherals', 'Peripherals & Accessories', 12, true),
      ('43fdb502-c820-4e95-b610-8117bc582bb0', 'software',    'Software & Licenses',       13, true),
      ('1835d8f4-6514-4a1a-9011-b4a3789f7c98', 'power',       'UPS & Power',               14, true),
      -- 2 preserved inactive, parked after the active range exactly as the
      -- production path leaves them
      ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed', 'tablets',     'Tablets/Ipad Pro',          15, false),
      ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d', 'audio',       'Audio/Headphones',          16, false);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 16 THEN
      RAISE EXCEPTION 'migration 0007 step 4 FAILED: inserted % categories on fresh install, expected 16 (14 active + 2 inactive)', v_affected;
    END IF;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. POST-CHECKS — identical for both modes, because both modes must produce
--    the same rows. Any failure aborts the whole transaction, marker included.
-- ---------------------------------------------------------------------------

-- 5a. Exactly 14 active categories, and exactly the approved rows.
DO $$
DECLARE
  n    integer;
  v_ok boolean;
BEGIN
  SELECT count(*) INTO n FROM public.categories WHERE is_active = true;
  IF n <> 14 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: expected 14 active categories, found %', n;
  END IF;

  SELECT bool_and(
    (id, slug, label, position) IN (
      ('84d6206c-c5f0-48ce-8bd6-f653e4a78ba7', 'computers',   'Computers & Laptops',        1),
      ('0c0d1c35-2e2e-46d6-85a1-c15bf69c2f32', 'desktops',    'Desktop Computers',          2),
      ('3a7b6117-2a1d-4dc8-98e1-7fcc2fe4d829', 'servers',     'Servers',                    3),
      ('1d5c2bf8-4948-48d0-9e64-d32d87ed72a1', 'networking',  'Networking & Telecom',       4),
      ('1afa9181-d014-40a1-84b0-77b3b9d49c91', 'components',  'PC Components',              5),
      ('d68104ff-a80e-4281-a8a1-8189cd423c2c', 'smartphones', 'Smartphones & Tablets',      6),
      ('c69827ba-1c33-4dd6-993e-ecc34cca9702', 'wearables',   'Wearables & Smartwatches',   7),
      ('dcc07a8b-ce35-4af8-86a1-eba2d5db7526', 'gaming',      'Gaming',                     8),
      ('115696d3-4e3b-4632-b6fb-d4f25352b798', 'printers',    'Printers & Scanners',        9),
      ('22e6f582-bd46-46c8-9542-19a87e74d2cc', 'monitors',    'Monitors & Displays',       10),
      ('7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1', 'multimedia',  'Multimedia & Audio',        11),
      ('60f1fd6e-2227-498b-ae51-6f375e6e30b5', 'peripherals', 'Peripherals & Accessories', 12),
      ('43fdb502-c820-4e95-b610-8117bc582bb0', 'software',    'Software & Licenses',       13),
      ('1835d8f4-6514-4a1a-9011-b4a3789f7c98', 'power',       'UPS & Power',               14)
    )
  ) INTO v_ok
  FROM public.categories WHERE is_active = true;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: active category rows do not match the approved taxonomy (id/slug/label/position)';
  END IF;
END $$;

-- 5b. Exactly 2 inactive categories (tablets, audio), parked at 15 and 16.
DO $$
DECLARE
  n    integer;
  v_ok boolean;
BEGIN
  SELECT count(*) INTO n FROM public.categories WHERE is_active = false;
  IF n <> 2 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: expected 2 inactive categories, found %', n;
  END IF;

  SELECT bool_and(
    (id, slug, label, position) IN (
      ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed', 'tablets', 'Tablets/Ipad Pro', 15),
      ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d', 'audio',   'Audio/Headphones', 16)
    )
  ) INTO v_ok
  FROM public.categories WHERE is_active = false;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: inactive rows do not match (tablets, audio) parked at positions 15 and 16';
  END IF;
END $$;

-- 5c. 16 rows total, no duplicate positions anywhere (active rows occupy
--     1..14, the parked rows 15..16), no NULL positions, and no legacy slug
--     resurrected.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.categories;
  IF n <> 16 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: expected 16 category rows, found %', n;
  END IF;

  SELECT count(*) INTO n FROM public.categories WHERE position IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: % category row(s) have a NULL position (position is NOT NULL)', n;
  END IF;

  -- Every position is now unique across the whole table, active or not, so
  -- this checks all 16 rows rather than only the 14 active ones.
  SELECT count(*) INTO n FROM (
    SELECT position FROM public.categories GROUP BY position HAVING count(*) > 1
  ) d;
  IF n <> 0 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: % duplicate position(s) across categories', n;
  END IF;

  SELECT count(*) INTO n FROM public.categories
   WHERE slug IN ('phones', 'laptops', 'accessories');
  IF n <> 0 THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: % legacy slug(s) still present (phones/laptops/accessories)', n;
  END IF;
END $$;

-- 5d. No product of ANY status is left on an inactive category.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(format('%s (%s) on %s', p.slug, p.id, c.slug), ', ') INTO v_bad
  FROM public.products p
  JOIN public.categories c ON c.id = p.category_id
  WHERE c.is_active = false;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: product(s) still on an inactive category: %', v_bad;
  END IF;
END $$;

-- 5e. Product counts unchanged from the recorded baseline.
DO $$
DECLARE
  v_mode          text;
  v_before        integer;
  v_active_before integer;
  v_now           integer;
  v_active_now    integer;
BEGIN
  SELECT mode, products_before, active_products_before
    INTO v_mode, v_before, v_active_before
  FROM public._migration_0007_state;

  SELECT count(*) INTO v_now        FROM public.products;
  SELECT count(*) INTO v_active_now FROM public.products WHERE is_active = true;

  IF v_now <> v_before OR v_active_now <> v_active_before THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: product counts changed (% -> %, active % -> %)',
      v_before, v_now, v_active_before, v_active_now;
  END IF;

  IF v_mode = 'production' AND (v_now <> 12 OR v_active_now <> 12) THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: expected 12 products (all active) on the production snapshot, found % total / % active',
      v_now, v_active_now;
  END IF;
END $$;

-- 5f. Expected product distribution.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.products WHERE category_id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c';
  IF n NOT IN (0, 5) THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: smartphones has % products, expected 5 (3 iphones + 2 ipads) or 0 on a fresh install', n;
  END IF;

  SELECT count(*) INTO n FROM public.products WHERE category_id = '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7';
  IF n NOT IN (0, 2) THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: computers has % products, expected 2 macbooks or 0 on a fresh install', n;
  END IF;

  SELECT count(*) INTO n FROM public.products WHERE category_id = '7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1';
  IF n NOT IN (0, 3) THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: multimedia has % products, expected 3 audio products or 0 on a fresh install', n;
  END IF;

  SELECT count(*) INTO n FROM public.products WHERE category_id = 'c69827ba-1c33-4dd6-993e-ecc34cca9702';
  IF n NOT IN (0, 2) THEN
    RAISE EXCEPTION 'migration 0007 post-check FAILED: wearables has % products, expected 2 watches or 0 on a fresh install', n;
  END IF;
END $$;

-- 5g. Operator-readable summary.
SELECT
  s.mode AS installation_mode,
  (SELECT count(*) FROM public.categories WHERE is_active)     AS active_categories,
  (SELECT count(*) FROM public.categories WHERE NOT is_active) AS inactive_categories,
  (SELECT count(*) FROM public.products)                       AS products,
  (SELECT count(*) FROM public.products WHERE is_active)        AS active_products
FROM public._migration_0007_state s;

SELECT
  c.position,
  c.slug,
  c.label,
  c.is_active,
  (SELECT count(*) FROM public.products p WHERE p.category_id = c.id)                 AS products_all,
  (SELECT count(*) FROM public.products p WHERE p.category_id = c.id AND p.is_active) AS products_active
FROM public.categories c
ORDER BY c.is_active DESC, c.position, c.slug;

COMMIT;
