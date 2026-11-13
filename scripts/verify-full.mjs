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

async function rpc(fn, params) {
  const r = await supabase.rpc(fn, params);
  return r;
}

async function run() {
  const catColsTry = [
    'id, slug, label, position, created_at, updated_at, is_active',
    'id, slug, label, position, created_at, updated_at',
    'id, slug, label, position, created_at',
  ];
  let catCols = null;
  for (const sel of catColsTry) {
    const r = await supabase.from('categories').select(sel).limit(1);
    if (!r.error && r.data && r.data.length) { catCols = sel; break; }
  }
  console.log('=== categories column set that works ===');
  console.log(catCols);
  const catR = await supabase.from('categories').select(catCols || 'id, slug, label, position, created_at').order('position').order('created_at');
  if (catR.error) console.error('categories full read error:', catR.error.message);
  const allCats = catR.data || [];
  console.log('\n=== ALL CATEGORIES (', allCats.length, 'rows ) ===');
  for (const c of allCats) console.log(JSON.stringify(c));

  const slugCounts = new Map();
  for (const c of allCats) slugCounts.set(c.slug, (slugCounts.get(c.slug)||0)+1);
  console.log('\n=== slug duplicate check ===');
  let dupFound = false;
  for (const [s,n] of slugCounts) { if (n>1) { console.log('DUPLICATE SLUG:', s, 'count=', n); dupFound = true; } }
  if (!dupFound) console.log('No duplicate slugs. distinct slugs:', slugCounts.size, 'rows:', allCats.length);

  // products full read WITHOUT is_active in the joined categories (column doesn't exist)
  const prodSel = 'id, slug, title, category_id, is_active, is_featured, price_cents, compare_at_price_cents, stock_on_hand, badge, rating, reviews, created_at, category:categories(id,slug,label,position)';
  const prodR = await supabase.from('products').select(prodSel).order('created_at');
  if (prodR.error) console.error('products full read error:', prodR.error.message);
  const allProds = prodR.data || [];
  console.log('\n=== ALL PRODUCTS (', allProds.length, 'rows ) ===');
  for (const p of allProds) {
    console.log(JSON.stringify({
      id: p.id, slug: p.slug, title: p.title,
      category_id: p.category_id,
      category_slug: p.category?.slug ?? null,
      category_label: p.category?.label ?? null,
      is_active: p.is_active, is_featured: p.is_featured,
      price_cents: p.price_cents, compare_at_price_cents: p.compare_at_price_cents,
      stock_on_hand: p.stock_on_hand, badge: p.badge, rating: p.rating, reviews: p.reviews,
      created_at: p.created_at
    }));
  }

  const suspectR = await supabase
    .from('products')
    .select('id, slug, title, category:categories(id,slug,label)')
    .or(`category.slug.eq.phones,category.slug.eq.laptops,category.slug.eq.tablets,category.slug.eq.audio,category.slug.eq.wearables`);
  if (suspectR.error) console.error('suspect read error:', suspectR.error.message);
  const suspect = suspectR.data || [];
  console.log('\n=== PRODUCTS in the 5 old categories (phones/laptops/tablets/audio/wearables) ===');
  console.log('count:', suspect.length);
  for (const p of suspect) {
    console.log(JSON.stringify({ id:p.id, slug:p.slug, title:p.title, cat:p.category?.slug, catLabel:p.category?.label }));
  }

  // constraint inspection attempts
  const fkCheck = await rpc('pg_get_constraints', { schema: 'public' });
  console.log('\n=== pg_get_constraints(public) ===');
  console.log(JSON.stringify(fkCheck.data ?? fkCheck.error ?? fkCheck).slice(0, 3000));

  const colCheckC = await rpc('pg_get_columns', { schema: 'public', table: 'categories' });
  console.log('\n=== pg_get_columns(categories) ===');
  console.log(JSON.stringify(colCheckC.data ?? colCheckC.error ?? colCheckC).slice(0, 2000));

  const colCheckP = await rpc('pg_get_columns', { schema: 'public', table: 'products' });
  console.log('\n=== pg_get_columns(products) ===');
  console.log(JSON.stringify(colCheckP.data ?? colCheckP.error ?? colCheckP).slice(0, 2000));

  const tables = await rpc('pg_get_tables', { schema: 'public' });
  const tableNames = (tables.data || []).map(function(t){ return t.table_name; }).filter(Boolean);
  console.log('\n=== all tables in public ===');
  for (const t of tableNames) console.log(t);

  const preservedIds = [
    'fd414ab7-0ef6-443f-a7f0-fb1a7234deed',
    '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d',
    'c69827ba-1c33-4dd6-993e-ecc34cca9702'
  ];
  for (const tname of tableNames) {
    const colsRes = await supabase.from('information_schema.columns')
      .select('column_name,data_type').eq('table_schema','public').eq('table_name', tname).order('ordinal_position');
    const colNames = (colsRes.data||[]).map(function(c){ return c.column_name; });
    const catIdCol = colNames.find(function(c){ return c.toLowerCase() === 'category_id'; });
    if (catIdCol) {
      const rowsR = await supabase.from(tname).select(catIdCol).in(catIdCol, preservedIds);
      if (rowsR.error) {
        console.log(tname + '.' + catIdCol + ': error reading refs ->', rowsR.error.message);
      } else {
        const rows = rowsR.data || [];
        console.log(tname + '.' + catIdCol + ': ' + rows.length + ' rows reference the 3 preserved categories');
        if (rows.length) {
          for (const r of rows.slice(0,5)) console.log('   ', JSON.stringify(r));
        }
      }
    }
  }

  const prodRefR = await supabase
    .from('products').select('id, slug, title, category_id')
    .in('category_id', preservedIds);
  if (prodRefR.error) console.error('prodRef read error:', prodRefR.error.message);
  console.log('\n=== PRODUCTS currently referencing the 3 preserved category ids (before any migration) ===');
  for (const p of (prodRefR.data||[])) console.log(JSON.stringify(p));

  // Also check which preserved id each product references
  for (const pid of preservedIds) {
    const prR = await supabase.from('products').select('id, slug, title').eq('category_id', pid);
    console.log('\n=== PRODUCTS referencing preserved category', pid, ':', (prR.data||[]).length, 'rows ===');
    for (const p of (prR.data||[])) console.log(JSON.stringify(p));
  }

  // pre-migration snapshot
  const snapshot = {
    categories: allCats,
    products: allProds.map(function(p){
      return {
        id: p.id, slug: p.slug, title: p.title,
        category_id: p.category_id,
        category_slug: p.category?.slug, category_label: p.category?.label,
        is_active: p.is_active, is_featured: p.is_featured,
        price_cents: p.price_cents, compare_at_price_cents: p.compare_at_price_cents,
        stock_on_hand: p.stock_on_hand, badge: p.badge, rating: p.rating, reviews: p.reviews,
        created_at: p.created_at
      };
    }),
    taken_at: new Date().toISOString()
  };
  const fs = await import('node:fs');
  fs.writeFileSync(join(__dirname,'scripts/pre-migration-snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log('\n=== pre-migration snapshot written to scripts/pre-migration-snapshot.json ===');

  const brandsR = await supabase.from('brands').select('id,slug,name,position,is_active').order('position');
  const brands = brandsR.data || [];
  console.log('\n=== BRANDS (', brands.length, ') ==='); for (const b of brands) console.log(JSON.stringify(b));
}

run().catch(function(err){ console.error(err); process.exit(1); });
