-- 0007_categories_taxonomy_rollback.sql
-- Lives at supabase/rollback/0007_categories_taxonomy_rollback.sql.
--
-- NOT a CLI migration. This file is deliberately OUTSIDE supabase/migrations so
-- that `supabase db reset` / `supabase db push` never discover or apply it; run
-- it manually with psql, after explicit authorization, against the intended
-- database. Do not move it back into supabase/migrations, and do not add the
-- rollback directory to any CLI-discovered path.
--
-- Reverse supabase/migrations/0007_categories_taxonomy.sql (REUSE strategy).
--
-- MODE-AWARE. The migration records the mode it ran in inside
-- public._migration_0007_state. This script READS that record and verifies it;
-- it never guesses. If the marker table is missing or its contents are not the
-- expected single row, the rollback aborts before changing anything.
--
--   mode = 'production'  -> restore the exact original FIVE-CATEGORY state:
--                           relabel smartphones->phones, computers->laptops,
--                           wearables back, reactivate tablets + audio AND put
--                           their positions back to 2 and 3, move products
--                           back, delete the 11 new rows, drop is_active,
--                           drop the marker.
--   mode = 'fresh'       -> restore the actual pre-migration FRESH state:
--                           ZERO categories, no products, no is_active, no
--                           marker. It does NOT leave five categories behind.
--
-- Because the migration never deletes and never recreates a category row,
-- no UUID changes in either direction, so no foreign key or external reference
-- can break. Production restoration and verification use the exact
-- pre-migration snapshot recorded by migration 0007, including created_at.
--
-- Everything runs inside ONE DO block so that a single BEGIN/COMMIT gives full
-- atomicity across both branches, and so the branch is chosen at runtime from
-- the verified mode rather than by a human.

BEGIN;

DO $$
DECLARE
  v_mode        text;
  v_n           integer;
  v_ok          boolean;
  v_bad         text;
  v_snapshot    jsonb;
  v_digest      text;
  v_actual      jsonb;
  v_rows_before integer;
BEGIN
  -- ---------------------------------------------------------------------
  -- P. Locate and verify the mode record. No guessing, no defaults.
  -- ---------------------------------------------------------------------

  IF to_regclass('public._migration_0007_state') IS NULL THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: public._migration_0007_state is missing, so the installation mode cannot be verified. Refusing to guess.';
  END IF;

  SELECT count(*) INTO v_n FROM public._migration_0007_state;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: public._migration_0007_state has % rows, expected exactly 1', v_n;
  END IF;

  SELECT mode INTO v_mode FROM public._migration_0007_state;
  IF v_mode NOT IN ('production', 'fresh') THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: unrecognised recorded mode %', quote_literal(v_mode);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'categories'
      AND column_name  = 'is_active'
  ) THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: categories.is_active does not exist, so migration 0007 is not applied (recorded mode %)', v_mode;
  END IF;

  -- Verify the recorded pre-migration snapshot before using it for restoration.
  SELECT snapshot, snapshot_md5 INTO v_snapshot, v_digest
    FROM public._migration_0007_state;

  IF md5(v_snapshot::text) <> v_digest THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: the recorded snapshot no longer matches its digest — the mode record was altered after migration 0007 wrote it. Refusing to restore from it.';
  END IF;

  IF jsonb_typeof(v_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: recorded snapshot is not a JSON array (found %)', jsonb_typeof(v_snapshot);
  END IF;

  IF v_mode = 'production' AND jsonb_array_length(v_snapshot) <> 5 THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: production mode requires a five-row snapshot, found % row(s)', jsonb_array_length(v_snapshot);
  END IF;

  IF v_mode = 'fresh' AND v_snapshot <> '[]'::jsonb THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: fresh mode recorded a non-empty snapshot — the record is internally inconsistent.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_snapshot) AS s(item)
     WHERE jsonb_typeof(s.item) <> 'object'
        OR NOT (s.item ?& array['id','slug','label','position','created_at'])
        OR (s.item->>'id')         IS NULL
        OR (s.item->>'id')         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (s.item->>'position')   IS NULL
        OR (s.item->>'position')   !~ '^-?[0-9]{1,9}$'
        OR (s.item->>'created_at') IS NULL
        OR (s.item->>'created_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
        OR (s.item->>'slug')       IS NULL
        OR btrim(s.item->>'slug')  = ''
        OR (s.item->>'label')      IS NULL
        OR btrim(s.item->>'label') = ''
  ) THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: the recorded snapshot has a malformed row; expected id, slug, label, non-NULL position and canonical UTC created_at for every entry.';
  END IF;

  IF (SELECT count(DISTINCT s.item->>'id')
        FROM jsonb_array_elements(v_snapshot) AS s(item))
     <> jsonb_array_length(v_snapshot) THEN
    RAISE EXCEPTION 'rollback 0007 precondition FAILED: the recorded snapshot contains duplicate ids.';
  END IF;

  -- =====================================================================
  -- BRANCH 1: PRODUCTION
  -- =====================================================================

  IF v_mode = 'production' THEN

    -- P1. The database must be in the post-migration production state.
    SELECT count(*) INTO v_n FROM public.categories WHERE is_active = true;
    IF v_n <> 14 THEN
      RAISE EXCEPTION 'rollback 0007 precondition FAILED: expected 14 active categories before reversing, found %', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.categories WHERE is_active = false;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'rollback 0007 precondition FAILED: expected 2 inactive categories before reversing, found %', v_n;
    END IF;

    -- R1. Restore every recorded row from the snapshot: slug, label, position
    --     and active flag. No literal id, label or position appears here, so
    --     this restores whatever 0007 actually found, including created_at
    --     values that differ from production.
    UPDATE public.categories AS c
       SET slug      = s.item->>'slug',
           label     = s.item->>'label',
           position  = (s.item->>'position')::integer,
           is_active = true
      FROM jsonb_array_elements(v_snapshot) AS s(item)
     WHERE c.id = (s.item->>'id')::uuid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> jsonb_array_length(v_snapshot) THEN
      RAISE EXCEPTION 'rollback 0007 step R1 FAILED: restored % row(s) from the snapshot, expected %. The record does not describe this database.', v_n, jsonb_array_length(v_snapshot);
    END IF;

    -- R3. Move products back. Scoped by the NEW category_id plus the exact
    --     slugs, so a re-run affects 0 rows and any product created after the
    --     migration is left for the R4 guard.
    UPDATE public.products
       SET category_id = 'fd414ab7-0ef6-443f-a7f0-fb1a7234deed'   -- tablets
     WHERE category_id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c'   -- smartphones
       AND slug IN ('apple-ipad-pro-m1-12-inch-2022', 'apple-ipad-pro-m1-11-inch-2021');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'rollback 0007 step R3-1 FAILED: moved % ipads back to tablets, expected 2', v_n;
    END IF;

    UPDATE public.products
       SET category_id = '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d'   -- audio
     WHERE category_id = '7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1'   -- multimedia
       AND slug IN ('proove-wireless-headset-gaming-bliss',
                    'apple-airpods-3-2022',
                    'portable-wireless-speakers-2025');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 3 THEN
      RAISE EXCEPTION 'rollback 0007 step R3-2 FAILED: moved % audio products back, expected 3', v_n;
    END IF;

    -- iphones / macbooks / watches never changed category_id.

    -- R4. Guard before deleting: no product of any status may still reference
    --     one of the 11 new rows. Clear message instead of a bare FK error.
    SELECT string_agg(format('%s (%s) on %s', p.slug, p.id, c.slug), ', ') INTO v_bad
    FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE c.id IN (
      '0c0d1c35-2e2e-46d6-85a1-c15bf69c2f32',
      '3a7b6117-2a1d-4dc8-98e1-7fcc2fe4d829',
      '1d5c2bf8-4948-48d0-9e64-d32d87ed72a1',
      '1afa9181-d014-40a1-84b0-77b3b9d49c91',
      'dcc07a8b-ce35-4af8-86a1-eba2d5db7526',
      '115696d3-4e3b-4632-b6fb-d4f25352b798',
      '22e6f582-bd46-46c8-9542-19a87e74d2cc',
      '7e8b2e2a-517f-4fd8-8dfb-5e7fd335f3c1',
      '60f1fd6e-2227-498b-ae51-6f375e6e30b5',
      '43fdb502-c820-4e95-b610-8117bc582bb0',
      '1835d8f4-6514-4a1a-9011-b4a3789f7c98'
    );
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'rollback 0007 guard FAILED: product(s) still on a new category — reassign them first: %', v_bad;
    END IF;

    -- R5. Delete every category row the snapshot does not contain — the 11 rows
    --     0007 created, whatever their ids.
    SELECT count(*) INTO v_rows_before FROM public.categories;
    DELETE FROM public.categories AS c
     WHERE NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements(v_snapshot) AS s(item)
        WHERE (s.item->>'id')::uuid = c.id
     );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> v_rows_before - jsonb_array_length(v_snapshot) THEN
      RAISE EXCEPTION 'rollback 0007 step R5 FAILED: deleted % row(s), expected %', v_n, v_rows_before - jsonb_array_length(v_snapshot);
    END IF;

    -- R6. Drop is_active (restores the original 5-column shape).
    ALTER TABLE public.categories DROP COLUMN is_active;

    -- R7. Verify exact restoration of the production snapshot. The position
    --     values prove R1 undid the 15/16 parking. Nothing is compared against
    --     a literal: id, slug, label, position and created_at must match the
    --     snapshot recorded by migration 0007.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id',         c.id,
             'slug',       c.slug,
             'label',      c.label,
             'position',   c.position,
             'created_at', to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
           ) ORDER BY c.id), '[]'::jsonb)
      INTO v_actual
      FROM public.categories c;

    IF v_actual IS DISTINCT FROM v_snapshot THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: restored rows do not match the snapshot migration 0007 captured.%',
        E'\n  expected: ' || v_snapshot::text ||
        E'\n  actual:   ' || v_actual::text;
    END IF;

    -- Products must be back on the 5 original categories.
    SELECT count(*) INTO v_n
    FROM public.products p
    WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: % product(s) point at a missing category', v_n;
    END IF;

    SELECT count(*) INTO v_n
    FROM public.products AS p
    WHERE NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_snapshot) AS s(item)
       WHERE (s.item->>'id')::uuid = p.category_id
    );
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: % product(s) on an unexpected category after rollback', v_n;
    END IF;

    RAISE NOTICE 'rollback 0007 complete: restored the production five-category snapshot with created_at preserved';

  -- =====================================================================
  -- BRANCH 2: FRESH
  -- =====================================================================

  ELSIF v_mode = 'fresh' THEN

    -- P2. The database must be in the post-migration fresh state.
    SELECT count(*) INTO v_n FROM public.categories;
    IF v_n <> 16 THEN
      RAISE EXCEPTION 'rollback 0007 precondition FAILED: fresh install expected 16 category rows before reversing, found %', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.categories WHERE is_active = true;
    IF v_n <> 14 THEN
      RAISE EXCEPTION 'rollback 0007 precondition FAILED: fresh install expected 14 active categories before reversing, found %', v_n;
    END IF;

    -- P3. On a fresh install the pre-migration state had no products at all.
    --     If seed data now references categories, deleting them would either
    --     hit the foreign key or destroy seed data, so refuse and point at the
    --     supported route instead.
    SELECT count(*) INTO v_n FROM public.products;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'rollback 0007 precondition FAILED: fresh install now has % product(s) referencing categories. This rollback only reverses the migration itself; to return a fresh database to a blank state use `supabase db reset` or delete the seeded products first.', v_n;
    END IF;

    -- R8. Remove every category row the migration created, leaving zero — the
    --     actual pre-migration fresh state.
    DELETE FROM public.categories;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 16 THEN
      RAISE EXCEPTION 'rollback 0007 step R8 FAILED: deleted % categories, expected 16', v_n;
    END IF;

    -- R9. Drop is_active.
    ALTER TABLE public.categories DROP COLUMN is_active;

    -- R10. Verify the blank pre-migration state against the recorded snapshot.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id,
             'slug', c.slug,
             'label', c.label,
             'position', c.position,
             'created_at', to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
           ) ORDER BY c.id), '[]'::jsonb)
      INTO v_actual
      FROM public.categories c;

    IF v_actual IS DISTINCT FROM v_snapshot THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: fresh rollback left rows behind — expected the recorded empty snapshot, found %', v_actual::text;
    END IF;

    SELECT count(*) INTO v_n FROM public.categories;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: expected 0 categories after a fresh-mode rollback, found %', v_n;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'is_active'
    ) THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: categories.is_active still exists';
    END IF;

    RAISE NOTICE 'rollback 0007 complete: fresh install returned to zero categories (pre-migration state)';

  END IF;

  -- ---------------------------------------------------------------------
  -- Z. Drop the mode marker last, so the recorded mode stayed readable for
  --    the whole reversal and no new table is left behind.
  -- ---------------------------------------------------------------------

  DROP TABLE public._migration_0007_state;
  DROP FUNCTION IF EXISTS public._migration_0007_state_write_once();
END $$;

COMMIT;
