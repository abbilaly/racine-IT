import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
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

async function tryCol(tname, col) {
  const r = await supabase.from(tname).select(col).limit(1);
  if (r.error) return { ok: false, error: r.error.message };
  return { ok: true, columns: [col] };
}

async function run() {
  // 1) list of table names from the migration SQL (authoritative schema source)
  const knownTables = [
    'categories','products','product_images','product_variants','inventory',
    'brands','store_settings','orders','order_items','users','admin_roles',
    'shop_settings','newsletter_subscribers'
  ];

  console.log('=== which tables have a category_id column (functional test, one col per table) ===');
  const catIdTables = [];
  for (const t of knownTables) {
    const r = await supabase.from(t).select('category_id').limit(1);
    if (!r.error) {
      console.log('  HAS category_id:', t, '-> sample:', JSON.stringify(r.data[0]));
      catIdTables.push(t);
    } else {
      console.log('  no category_id:', t, '->', r.error.message.slice(0,90));
    }
  }

  // 2) products: null category_id check + orphan check
  const nullR = await supabase.from('products').select('id, category_id').filter('category_id', 'is', null);
  console.log('\n=== products with NULL category_id (filter is null):', (nullR.data||[]).length, '===')
  for (const p of (nullR.data||[])) console.log(JSON.stringify(p));

  const prodsWithCat = await supabase.from('products').select('id, category_id').filter('category_id', 'is not', null);
  const catIds = new Set((await supabase.from('categories').select('id')).data||[]).map(c=>c.id);
  const orphans = (prodsWithCat.data||[]).filter(p => !catIds.has(p.category_id));
  console.log('\n=== products.category_id NOT NULL rows:', (prodsWithCat.data||[]).length, '===')
  console.log('=== categories ids:', catIds.size, '===')
  console.log('=== products whose category_id is not in categories.id (orphans):', orphans.length, '===')
  for (const o of orphans) console.log(JSON.stringify(o));

  // 3) confirm categories slug uniqueness functionally (already did via JS map, re-confirm with count of distinct)
  const catsR = await supabase.from('categories').select('slug');
  const slugList = (catsR.data||[]).map(c=>c.slug);
  const distinct = new Set(slugList);
  console.log('\n=== categories distinct slugs:', distinct.size, 'of', slugList.length, 'rows ===');
  if (distinct.size !== slugList.length) console.log('SLUG DUPLICATE DETECTED');

  // 4) check the 3 preserved categories' ids are still referenced by ANY product (should be yes, before migration)
  const preservedIds = [
    'fd414ab7-0ef6-443f-a7f0-fb1a7234deed', // tablets
    '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d', // audio
    'c69827ba-1c33-4dd6-993e-ecc34cca9702'  // wearables
  ];
  for (const pid of preservedIds) {
    const r = await supabase.from('products').select('id, slug, title').eq('category_id', pid);
    console.log('\n=== products referencing preserved category', pid, ':', (r.data||[]).length, 'rows ===');
    for (const p of (r.data||[])) console.log(JSON.stringify(p));
  }

  // 5) check products referencing the 2 REUSED categories (phones, laptops) before migration
  const reusedIds = {
    'd68104ff-a80e-4281-a8a1-8189cd423c2c': 'phones (will become smartphones)',
    '84d6206c-c5f0-48ce-8bd6-f653e4a78ba7': 'laptops (will become computers)'
  };
  for (const [id, label] of Object.entries(reusedIds)) {
    const r = await supabase.from('products').select('id, slug, title, price_cents, badge').eq('category_id', id);
    console.log('\n=== products referencing reused category', id, '(', label, '):', (r.data||[]).length, 'rows ===');
    for (const p of (r.data||[])) console.log(JSON.stringify(p));
  }

  // 6) check product_images / inventory referencing the 12 product ids (to confirm no category_id there, but inventory/product_images reference products)
  const twelveIds = [
    '95a997e0-dc56-482b-b5fb-5d078af879af', // iphone pink
    'a4977f04-a1ea-424c-8da0-40adc8ef7c78', // apple watch pride
    '264f6edc-9b3f-4e68-ae95-56e6ac83449b', // ipad 12"
    '694b5337-731b-4919-b539-865fff4d8d53', // valdus watch
    '84844ee4-c36c-4384-9e2f-4c8a29e95103', // ipad 11"
    'a3cd6b22-56b8-4fcc-b992-45be3047816e', // prove headset
    '218ac2b1-221a-4b7e-bad8-b845b838286c', // macbook m3
    '4018ff4c-cd1a-4cb3-8704-f3b070363eb4', // iphone blue
    'a951011f-7836-4af3-9ca2-1c7565c71159', // airpods
    '43a0b09a-3326-4d75-af06-0a8ba5b91534', // macbook m2
    '54407483-3351-4ecf-8321-9835aebad13d', // iphone white
    '36404303-9d88-4ad2-8558-c85759fbdd3a'  // speakers
  ];
  for (const t of ['product_images','inventory','product_variants']) {
    const r = await supabase.from(t).select('product_id').in('product_id', twelveIds);
    console.log('\n===', t, ': rows referencing the 12 product ids:', (r.data||[]).length, '===')
  }

  // 7) check orders / order_items for any category reference (should be none)
  for (const t of ['orders','order_items']) {
    const colr = await supabase.from(t).select('*').limit(1);
    if (!colr.error) {
      const colNames = Object.keys(colr.data[0]||{});
      const catCols = colNames.filter(c => /category/i.test(c));
      console.log('\n===', t, 'columns containing "category":', catCols.length === 0 ? 'none' : JSON.stringify(catCols));
    }
  }

  console.log('\n=== DONE ===');
}

run().catch(function(err){ console.error(err); process.exit(1); });
