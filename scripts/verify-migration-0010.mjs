#!/usr/bin/env node
/**
 * Migration 0010 verification against a throwaway in-process Postgres.
 *
 * WHY: migration 0010 has to be reviewed without touching the production
 * database. Docker is unavailable in this environment, so this runs the real
 * SQL against PGlite (Postgres compiled to WASM) in memory: nothing is
 * installed, connected to, or written outside this process.
 *
 * WHAT IT PROVES
 *   1. 0010 refuses to run before 0009 has created the banner table.
 *   2. It is idempotent (running twice is a no-op).
 *   3. Existing banners survive with the expected defaults.
 *   4. A mobile image plus both focal points persist.
 *   5. An invalid focal point is rejected by the new constraint.
 *   6. A banner without a mobile image falls back to the desktop image.
 *   7. The rollback removes the 0010 columns but keeps every banner row.
 *   8. 0010 can be re-applied after the rollback.
 *
 * RUN:  npm i --no-save @electric-sql/pglite && node scripts/verify-migration-0010.mjs
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = path => readFileSync(path, "utf8");
const MIGRATION_0009 = read("supabase/migrations/0009_homepage_banners.sql");
const MIGRATION_0010 = read("supabase/migrations/0010_homepage_banner_responsive.sql");
const ROLLBACK_0010 = read("supabase/rollback/0010_homepage_banner_responsive_rollback.sql");

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const fresh = async () => {
  const db = new PGlite();
  await db.waitReady;
  return db;
};

/** Roles and helper functions the 0009 policies/triggers reference. */
async function createSupabaseStubs(db) {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
  `).catch(async () => {
    // Roles are optional for the columns under test; ignore when unsupported.
  });
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean AS $$ SELECT false; $$ LANGUAGE sql STABLE;
  `);
}

async function columns(db) {
  const { rows } = await db.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'homepage_banners'
      AND column_name IN ('mobile_image_path', 'focus_desktop', 'focus_mobile')
    ORDER BY column_name
  `);
  return rows;
}

async function main() {
  // 1. Guard: 0010 must refuse to run without 0009.
  const guard = await fresh();
  await guard.exec("CREATE SCHEMA IF NOT EXISTS public;");
  let guardError = "";
  try {
    await guard.exec(MIGRATION_0010);
  } catch (error) {
    guardError = error instanceof Error ? error.message : String(error);
  }
  check(
    "0010 refuses to run before 0009",
    /requires migration 0009/i.test(guardError),
    guardError ? guardError.split("\n")[0].slice(0, 90) : "no error raised"
  );
  await guard.close();

  // 2. Real path: 0009, then existing banners, then 0010.
  const db = await fresh();
  await createSupabaseStubs(db);
  await db.exec(MIGRATION_0009);

  await db.exec(`
    INSERT INTO public.homepage_banners (title, subtitle, image_path, cta_label, cta_href, is_active, position)
    VALUES
      ('Existing desktop banner', 'Composed for wide screens', '/images/banner-wide.webp', 'Shop now', '/shop', true, 0),
      ('Second banner', '', '/images/banner-two.webp', 'Shop now', '/shop', true, 1);
  `);

  let applied = true;
  try {
    await db.exec(MIGRATION_0010);
  } catch (error) {
    applied = false;
    console.log("0010 failed:", error instanceof Error ? error.message : error);
  }
  check("0010 applies on the live 0009 schema", applied);

  let idempotent = true;
  try {
    await db.exec(MIGRATION_0010);
  } catch (error) {
    idempotent = false;
    console.log("second run failed:", error instanceof Error ? error.message : error);
  }
  check("0010 is idempotent", idempotent);

  const cols = await columns(db);
  const byName = Object.fromEntries(cols.map(row => [row.column_name, row]));
  check(
    "Three responsive columns exist",
    cols.length === 3,
    cols.map(row => row.column_name).join(", ")
  );
  check(
    "Mobile image is nullable (desktop-only banners stay valid)",
    byName.mobile_image_path?.is_nullable === "YES"
  );
  check(
    "Focus columns default to center",
    String(byName.focus_desktop?.column_default).includes("center") &&
      String(byName.focus_mobile?.column_default).includes("center")
  );

  const existing = await db.query(`
    SELECT title, mobile_image_path, focus_desktop, focus_mobile
    FROM public.homepage_banners ORDER BY position
  `);
  check(
    "Existing banners keep their content and get safe defaults",
    existing.rows.length === 2 &&
      existing.rows[0].mobile_image_path === null &&
      existing.rows[0].focus_desktop === "center" &&
      existing.rows[0].focus_mobile === "center"
  );

  // 3. Persistence of the new fields.
  await db.query(
    `UPDATE public.homepage_banners
     SET mobile_image_path = $1, focus_desktop = $2, focus_mobile = $3
     WHERE title = $4`,
    ["/images/banner-wide-mobile.webp", "right", "top", "Existing desktop banner"]
  );
  const updated = await db.query(
    `SELECT mobile_image_path, focus_desktop, focus_mobile
     FROM public.homepage_banners WHERE title = $1`,
    ["Existing desktop banner"]
  );
  check(
    "Mobile image and both focal points persist",
    updated.rows[0].mobile_image_path === "/images/banner-wide-mobile.webp" &&
      updated.rows[0].focus_desktop === "right" &&
      updated.rows[0].focus_mobile === "top"
  );

  // 4. Constraint rejects an unknown focal point.
  let constraintHeld = false;
  try {
    await db.exec(
      `UPDATE public.homepage_banners SET focus_mobile = 'diagonal' WHERE title = 'Existing desktop banner';`
    );
  } catch {
    constraintHeld = true;
  }
  check("An invalid focal point is rejected", constraintHeld);

  // 5. Storefront fallback: desktop image when no mobile image exists.
  const fallback = await db.query(`
    SELECT COALESCE(mobile_image_path, image_path) AS effective
    FROM public.homepage_banners WHERE title = 'Second banner'
  `);
  check(
    "A banner without a mobile image falls back to the desktop image",
    fallback.rows[0].effective === "/images/banner-two.webp"
  );

  // 6. Rollback keeps the rows and removes the columns.
  let rolledBack = true;
  try {
    await db.exec(ROLLBACK_0010);
  } catch (error) {
    rolledBack = false;
    console.log("rollback failed:", error instanceof Error ? error.message : error);
  }
  const afterRollback = await columns(db);
  const survivors = await db.query(
    `SELECT title, image_path FROM public.homepage_banners ORDER BY position`
  );
  check("Rollback runs", rolledBack);
  check("Rollback removes the three columns", afterRollback.length === 0);
  check(
    "Rollback keeps every banner row and its desktop image",
    survivors.rows.length === 2 &&
      survivors.rows[0].image_path === "/images/banner-wide.webp" &&
      survivors.rows[1].image_path === "/images/banner-two.webp"
  );

  // 7. Re-apply after rollback.
  let reApplied = true;
  try {
    await db.exec(MIGRATION_0010);
  } catch {
    reApplied = false;
  }
  check("0010 can be re-applied after the rollback", reApplied && (await columns(db)).length === 3);

  await db.close();

  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} migration checks passed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("Verification crashed:", error instanceof Error ? error.message : error);
  process.exit(2);
});
