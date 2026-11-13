import { createClient } from '@supabase/supabase-js';
import { readFileSync as _r, existsSync as _e } from 'node:fs';
import { fileURLToPath as _f } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = join(dirname(_f(import.meta.url)), '..');
for (const name of ['.env.local', '.env']) {
  const p = join(__dirname, name);
  if (!_e(p)) continue;
  for (const line of _r(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val.startsWith('`') && val.endsWith('`')) val = val.slice(1, -1);
    if (val.startsWith('$')) { try { val = process.env[val.slice(2)] ?? val; } catch {} }
    process.env[m[1]] = val;
  }
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: products, error } = await supabase
  .from('products')
  .select('id, slug, title, category_id, is_active')
  .in('category_id', [
    'd68104ff-a80e-4281-a8a1-8189cd423c2c',
    '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7',
    'fd414ab7-0ef6-443f-a7f0-fb1a7234deed',
    '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d',
  ])
  .order('category_id')
  .order('is_active', { ascending: false });
if (error) { console.error('AUDIT ERROR:', error.message); process.exit(1); }

console.log('=== ALL PRODUCTS (any status) referencing phones/laptops/tablets/audio ===');
if (!products || products.length === 0) {
  console.log('NONE - no product of any status references these four categories.');
} else {
  products.forEach(p => console.log(JSON.stringify({ id: p.id, slug: p.slug, is_active: p.is_active, category_id: p.category_id })));
}
console.log('COUNT referencing these four categories:', products?.length ?? 0);

const { data: inactive } = await supabase.from('products').select('id, slug, category_id').eq('is_active', false);
console.log('INACTIVE PRODUCTS (any category):', inactive?.length ?? 0, inactive ?? []);

const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true });
console.log('TOTAL PRODUCTS IN TABLE (all statuses):', total);

const { data: liveCats } = await supabase.from('categories').select('id, slug, label, position, created_at').order('position');
if (liveCats) {
  for (const c of liveCats) {
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', c.id);
    console.log('CAT', c.slug, c.id, 'position=' + c.position, 'created_at=' + c.created_at, 'ALL-product-count=', count);
  }
}
