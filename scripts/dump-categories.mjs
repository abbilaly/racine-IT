import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

function loadEnv() {
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
      if (val.startsWith('\$')) {
        try { val = process.env[val.slice(2)] ?? val; } catch {}
      }
      process.env[key] = val;
    }
  }
}
loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY after loading .env.local');
  console.error('SUPABASE_URL=', url);
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const cols = await supabase
    .from('information_schema.columns')
    .select("table_name,column_name,data_type,character_maximum_length,column_default,is_nullable,ordinal_position")
    .eq('table_schema', 'public')
    .in('table_name', ['categories', 'products', 'inventory', 'product_images', 'brands', 'store_settings'])
    .order('ordinal_position');

  const fks = await supabase
    .from('information_schema.table_constraints')
    .select('table_name,constraint_name,constraint_type')
    .eq('table_schema', 'public')
    .in('table_name', ['categories', 'products'])
    .eq('constraint_type', 'FOREIGN KEY');

  console.log('=== TABLES (information_schema.columns) ===');
  for (const c of cols.data || []) {
    console.log(JSON.stringify(c));
  }
  console.log('\n=== FOREIGN KEYS (categories, products) ===');
  for (const f of fks.data || []) {
    console.log(JSON.stringify(f));
  }

  const { data: cats, error: ce } = await supabase
    .from('categories')
    .select('id, slug, label, description, position, created_at')
    .order('position')
    .order('created_at');
  if (ce) console.error('categories select error:', ce.message);
  console.log('\n=== CATEGORIES (', (cats || []).length, 'rows ) ===');
  for (const c of cats || []) {
    console.log(JSON.stringify(c));
  }

  const { data: brands } = await supabase
    .from('brands')
    .select('id, slug, name, position')
    .order('position')
    .order('created_at');
  console.log('\n=== BRANDS (', (brands || []).length, 'rows ) ===');
  for (const b of brands || []) {
    console.log(JSON.stringify(b));
  }

  const { data: prods, error: pe } = await supabase
    .from('products')
    .select('id, slug, title, category_id, category:categories(id,slug,label), is_active, price_cents, created_at')
    .order('created_at');
  if (pe) console.error('products select error:', pe.message);

  const byCat = new Map();
  for (const p of (prods || [])) {
    const cid = p.category?.id ?? (p.category_id ? `FK-missing-id(${p.category_id})` : 'NO-CATEGORY');
    if (!byCat.has(cid)) byCat.set(cid, { category: p.category ?? null, products: [] });
    byCat.get(cid).products.push({ id: p.id, slug: p.slug, title: p.title, active: p.is_active, price_cents: p.price_cents });
  }
  console.log('\n=== PRODUCTS BY CATEGORY (', (prods || []).length, 'rows ) ===');
  for (const [cid, bucket] of byCat.entries()) {
    console.log('--- category node:', cid, '---');
    console.log('   category row:', JSON.stringify(bucket.category));
    for (const p of bucket.products) {
      console.log('   -', JSON.stringify({ slug: p.slug, title: p.title, active: p.active, price_cents: p.price_cents }));
    }
  }

  const [{ count: invCount }, { count: imgCount }, { count: settingsCount }] = await Promise.all([
    supabase.from('inventory').select('*', { count: 'exact', head: true }),
    supabase.from('product_images').select('*', { count: 'exact', head: true }),
    supabase.from('store_settings').select('*', { count: 'exact', head: true }),
  ]);
  console.log('\n=== COUNTS ===');
  console.log('inventory rows:', invCount);
  console.log('product_images rows:', imgCount);
  console.log('store_settings rows:', settingsCount);
}

main().catch(err => { console.error(err); process.exit(1); });
