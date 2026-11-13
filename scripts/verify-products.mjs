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

async function run() {
  // products: try several column sets until one works (we know stock_on_hand is wrong)
  const prodSets = [
    'id, slug, title, category_id, is_active, is_featured, price_cents, compare_at_price_cents, badge, rating, reviews, created_at, category:categories(id,slug,label,position)',
    'id, slug, title, category_id, is_active, is_featured, price_cents, compare_at_price_cents, badge, rating, reviews, created_at',
    'id, slug, title, category_id, is_active, price_cents, badge, rating, reviews, created_at, category:categories(id,slug,label,position)',
    'id, slug, title, category_id, is_active, price_cents, compare_at_price_cents, badge, rating, reviews, created_at, category:categories(id,slug,label,position)',
    'id, slug, title, category_id, price_cents, compare_at_price_cents, badge, rating, reviews, created_at, category:categories(id,slug,label,position)',
  ];
  let prodCols = null;
  for (const sel of prodSets) {
    const r = await supabase.from('products').select(sel).limit(1);
    if (!r.error && r.data && r.data.length) { prodCols = sel; break; }
  }
  console.log('=== products column set that works ===');
  console.log(prodCols);
  const r = await supabase.from('products').select(prodCols || 'id, slug, title, category_id, is_active, price_cents, badge, rating, reviews, created_at, category:categories(id,slug,label,position)').order('created_at');
  if (r.error) { console.error('products read error:', r.error.message); process.exit(1); }
  const prods = r.data || [];
  console.log('\n=== ALL PRODUCTS (', prods.length, 'rows ) ===');
  for (const p of prods) {
    console.log(JSON.stringify({
      id: p.id, slug: p.slug, title: p.title,
      category_id: p.category_id,
      category_slug: p.category?.slug ?? null,
      category_label: p.category?.label ?? null,
      is_active: p.is_active,
      price_cents: p.price_cents,
      compare_at_price_cents: p.compare_at_price_cents ?? null,
      badge: p.badge ?? null,
      rating: p.rating, reviews: p.reviews,
      created_at: p.created_at
    }));
  }

  // Count per active category slug
  const perCat = new Map();
  for (const p of prods) {
    const key = p.category?.slug ?? 'NO_CATEGORY';
    if (!perCat.has(key)) perCat.set(key, { slug: key, label: p.category?.label ?? null, count: 0, ids: [] });
    const b = perCat.get(key);
    b.count++; b.ids.push(p.id);
  }
  console.log('\n=== PRODUCT COUNT PER CATEGORY (by joined category slug) ===');
  for (const [k,b] of perCat) {
    console.log(JSON.stringify({ slug: b.slug, label: b.label, count: b.count, product_ids: b.ids }));
  }

  // specifically the 2 smartwatch products
  const watchR = await supabase.from('products').select('id, slug, title, category_id, category:categories(id,slug,label)')
    .or('category.slug.eq.wearables');
  console.log('\n=== PRODUCTS currently in wearables (smartwatches) ===');
  for (const p of (watchR.data||[])) console.log(JSON.stringify(p));

  // the 12 suspect products (phones/laptops/tablets/audio/wearables) — by category_id of the 5 existing cats
  const catsR = await supabase.from('categories').select('id, slug, label').order('position');
  const catIds = (catsR.data||[]).map(c=>c.id);
  const suspectR = await supabase.from('products').select('id, slug, title, category_id, category:categories(id,slug,label)')
    .in('category_id', catIds);
  console.log('\n=== PRODUCTS whose category_id is one of the 5 existing category ids ===');
  console.log('count:', (suspectR.data||[]).length);
  for (const p of (suspectR.data||[])) console.log(JSON.stringify(p));
}

run().catch(function(err){ console.error(err); process.exit(1); });
