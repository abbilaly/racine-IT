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
-- created_at is inherently preserved in production mode (rows were updated in
-- place), and no UUID changes in either direction, so no foreign key or
-- external reference can break.
--
-- Everything runs inside ONE DO block so that a single BEGIN/COMMIT gives full
-- atomicity across both branches, and so the branch is chosen at runtime from
-- the verified mode rather than by a human.

BEGIN;

DO $$
DECLARE
  v_mode  text;
  v_n     integer;
  v_ok    boolean;
  v_bad   text;
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

    -- R1. Reactivate the two preserved rows and restore their ORIGINAL
    --     positions. The ids were never deleted, so this is a flag flip plus a
    --     position move back from the parked 15/16 to 2/3.
    UPDATE public.categories c
       SET is_active = true,
           position  = v.position
      FROM (VALUES
        ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed'::uuid, 2),   -- tablets: 15 -> 2
        ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d'::uuid, 3)    -- audio:   16 -> 3
      ) AS v(id, position)
     WHERE c.id = v.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'rollback 0007 step R1 FAILED: reactivated/parked % rows, expected 2 (tablets, audio)', v_n;
    END IF;

    -- R2. Relabel the 3 reused rows back. Ids and created_at are untouched.
    UPDATE public.categories
       SET slug = 'phones', label = 'Phones/Mobile', position = 0
     WHERE id = 'd68104ff-a80e-4281-a8a1-8189cd423c2c';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'rollback 0007 step R2-1 FAILED: reverted % smartphones rows, expected 1', v_n;
    END IF;

    UPDATE public.categories
       SET slug = 'laptops', label = 'Macbook/PCs', position = 1
     WHERE id = '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'rollback 0007 step R2-2 FAILED: reverted % computers rows, expected 1', v_n;
    END IF;

    UPDATE public.categories
       SET label = 'Watches/Wearables', position = 4
     WHERE id = 'c69827ba-1c33-4dd6-993e-ecc34cca9702';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'rollback 0007 step R2-3 FAILED: reverted % wearables rows, expected 1', v_n;
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

    -- R5. Delete the 11 categories the migration created.
    DELETE FROM public.categories WHERE id IN (
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
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 11 THEN
      RAISE EXCEPTION 'rollback 0007 step R5 FAILED: deleted % new categories, expected 11', v_n;
    END IF;

    -- R6. Drop is_active (restores the original 5-column shape).
    ALTER TABLE public.categories DROP COLUMN is_active;

    -- R7. Verify exact restoration of the production snapshot. The position
    --     values below (tablets 2, audio 3) prove R1 undid the 15/16 parking.
    SELECT count(*) INTO v_n FROM public.categories;
    IF v_n <> 5 THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: expected 5 categories, found %', v_n;
    END IF;

    SELECT bool_and(
      (id, slug, label, position) IN (
        ('d68104ff-a80e-4281-a8a1-8189cd423c2c', 'phones',    'Phones/Mobile',     0),
        ('84d6206c-c5f0-48ce-8bd6-f653e4a78ba7', 'laptops',   'Macbook/PCs',       1),
        ('fd414ab7-0ef6-443f-a7f0-fb1a7234deed', 'tablets',   'Tablets/Ipad Pro',  2),
        ('5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d', 'audio',     'Audio/Headphones',  3),
        ('c69827ba-1c33-4dd6-993e-ecc34cca9702', 'wearables', 'Watches/Wearables', 4)
      )
    ) INTO v_ok
    FROM public.categories;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: rows do not match the verified pre-migration snapshot (id/slug/label/position)';
    END IF;

    -- created_at must still be the original instant: no row was ever deleted.
    SELECT bool_and(created_at = '2026-10-26T00:25:05.42357+00:00'::timestamptz) INTO v_ok
    FROM public.categories;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: created_at was not preserved for the original 5 rows';
    END IF;

    -- Products must be back on the 5 original categories.
    SELECT count(*) INTO v_n
    FROM public.products p
    WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'rollback 0007 verification FAILED: % product(s) point at a missing category', v_n;
    END IF;

    SELECT count(*) INTO v_n
    FROM public.products p
    WHERE p.category_id NOT IN (
      'd68104ff-a80e-4281-a8a1-8189cd423c2c',
      '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7',
      'fd414ab7-0ef6-443f-a7f0-fb1a7234deed',
      '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d',
      'c69827ba-1c33-4dd6-993e-ecc34cca9702'
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

    -- R10. Verify the blank pre-migration state.
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
END $$;

COMMIT;
