import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
for (const name of ['.env.local', '.env']) {
  const p = join(__dirname, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val.startsWith('`') && val.endsWith('`')) val = val.slice(1, -1);
    if (val.startsWith('$')) { try { val = process.env[val.slice(2)] ?? val; } catch {} }
    process.env[key] = val;
  }
}
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  const catR = await supabase.from('categories').select('id, slug, label, position, created_at').order('position').order('created_at');
  if (catR.error) { console.error('categories error:', catR.error.message); process.exit(1); }
  const categories = catR.data || [];

  const prodR = await supabase.from('products').select('id, slug, title, category_id, is_active, is_featured, price_cents, compare_at_price_cents, badge, rating, reviews, created_at').order('created_at');
  if (prodR.error) { console.error('products error:', prodR.error.message); process.exit(1); }
  const products = prodR.data || [];

  const snapshot = {
    captured_at: new Date().toISOString(),
    categories: categories,
    products: products,
    notes: {
      categories_columns_read: 'id, slug, label, position, created_at  (is_active does NOT exist yet)',
      products_columns_read: 'id, slug, title, category_id, is_active, is_featured, price_cents, compare_at_price_cents, badge, rating, reviews, created_at',
      verified_facts: {
        categories_has_is_active_column: false,
        products_category_id_is_not_null_for_all_12: true,
        only_table_with_category_id_column: 'products',
        categories_slug_unique_in_live_data: true,
        total_categories: categories.length,
        total_products: products.length,
        products_with_null_category_id: products.filter(p=>!p.category_id).length
      }
    }
  };
  const outPath = join(__dirname, 'pre-migration-snapshot.json');
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log('Snapshot written to:', outPath);
  console.log(JSON.stringify({ categories_count: categories.length, products_count: products.length, products_with_null_cat: products.filter(p=>!p.category_id).length }, null, 2));
}

run().catch(function(e){ console.error(e); process.exit(1); });
