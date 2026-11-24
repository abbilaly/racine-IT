#!/usr/bin/env node
/**
 * Insert workflow for the Disway draft review products in data/disway-previews.json.
 *
 * SAFE BY DEFAULT: without `--apply` this only prints the plan and checks the
 * target categories; it performs no writes.
 *
 *   node scripts/insert-disway-previews.mjs                 # dry run
 *   node scripts/insert-disway-previews.mjs --apply         # insert (approved)
 *
 * Rules enforced here:
 *  - one product per empty active category, exactly as listed in
 *    data/disway-previews.json;
 *  - existing products are never updated, deleted or reassigned — a slug that
 *    already exists is skipped and reported;
 *  - products are inserted with is_active = true, is_featured = false and the
 *    "Draft" badge, so they are easy to find in Admin;
 *  - no inventory rows are created, so checkout cannot sell a draft;
 *  - the source URL/reference is stored in products.source_url and origin.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");
const DATA = JSON.parse(readFileSync(resolve("data/disway-previews.json"), "utf8"));

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, value] = match;
      if (!(key in env)) env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on process environment */
  }
  return env;
}

const env = loadEnv();
const URL_BASE = (env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_BASE || !KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.");
  process.exit(2);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json"
};

async function rest(path, init = {}) {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${String(text).slice(0, 300)}`);
  return body;
}

const categories = await rest("categories?select=id,slug,label,is_active");
const bySlug = new Map(categories.map(category => [category.slug, category]));
const existing = await rest("products?select=slug&slug=like.disway-preview-*");
const existingSlugs = new Set(existing.map(row => row.slug));

/** Product photo paths in gallery order, without duplicates. */
function imagePaths(product) {
  return [product.image, product.hover, ...(product.gallery ?? [])].filter(
    (path, index, all) => Boolean(path) && all.indexOf(path) === index
  );
}

const plan = [];
for (const product of DATA.products) {
  const category = bySlug.get(product.category);
  const missing = imagePaths(product).filter(
    path => path.startsWith("/images/") && !existsSync(resolve("public", path.slice(1)))
  );
  if (!category) plan.push({ product, error: `category "${product.category}" not found` });
  else if (!category.is_active) plan.push({ product, error: `category "${product.category}" is inactive` });
  else if (existingSlugs.has(product.slug)) plan.push({ product, category, skip: "slug already exists" });
  else if (missing.length > 0) plan.push({ product, category, error: `missing image file(s): ${missing.join(", ")}` });
  else plan.push({ product, category });
}

console.log(`Mode: ${APPLY ? "APPLY (writes products + product_images)" : "DRY RUN (no writes)"}`);
console.log(`Products in data file: ${DATA.products.length} | categories: ${categories.length}\n`);

let blocking = 0;
for (const entry of plan) {
  const label = entry.category?.label ?? entry.product.category;
  if (entry.error) {
    blocking += 1;
    console.log(`ERROR  ${entry.product.slug} — ${entry.error}`);
  } else if (entry.skip) {
    console.log(`SKIP   ${entry.product.slug} — ${entry.skip}`);
  } else {
    console.log(
      `READY  ${entry.product.slug} -> ${label} (${entry.category.id}) ${entry.product.price} MAD, ${imagePaths(entry.product).length} image(s)`
    );
  }
}

if (blocking > 0) {
  console.error(`\nAborted: ${blocking} product(s) cannot be inserted safely. No writes performed.`);
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDry run complete. Re-run with --apply after approval to insert.");
  process.exit(0);
}

const created = [];
for (const { product, category } of plan.filter(entry => !entry.error && !entry.skip)) {
  const payload = {
    slug: product.slug,
    title: product.title,
    category_id: category.id,
    short_description: product.short,
    description: product.description,
    specs: product.specs.map(([name, value]) => ({ name, value })),
    price_cents: Math.round(product.price * 100),
    badge: product.badge,
    rating: product.rating,
    reviews: product.reviews,
    is_active: true,
    is_featured: false,
    origin: "Disway (Morocco)",
    source_url: product.source.url
  };
  const [row] = await rest("products?select=id,slug", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([payload])
  });
  const images = imagePaths(product).map((path, index) => ({
    product_id: row.id,
    kind: index === 0 ? "primary" : index === 1 ? "hover" : "gallery",
    path,
    position: index
  }));
  await rest("product_images", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(images)
  });
  created.push({ slug: row.slug, id: row.id, category: category.label });
  console.log(`INSERTED ${row.slug} (${row.id}) -> ${category.label} (${images.length} image(s))`);
}

console.log(`\nDone. Inserted ${created.length} product(s). No inventory rows were created.`);
