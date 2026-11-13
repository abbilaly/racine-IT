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
  // all table names via information_schema.tables (public schema)
  const tablesR = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .neq('table_type', 'VIEW')
    .order('table_name');
  console.log('=== public tables (information_schema.tables) ===');
  const tableNames = (tablesR.data||[]).map(t => t.table_name).filter(Boolean);
  for (const t of tableNames) console.log(t);
  console.log('total tables:', tableNames.length);

  // for each table, list columns; flag category_id columns
  console.log('\n=== tables with a category_id column ===');
  const preservedIds = [
    'fd414ab7-0ef6-443f-a7f0-fb1a7234deed',
    '5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d',
    'c69827ba-1c33-4dd6-993e-ecc34cca9702'
  ];
  for (const tname of tableNames) {
    const colsR = await supabase
      .from('information_schema.columns')
      .select('column_name,data_type,is_nullable,column_default')
      .eq('table_schema','public').eq('table_name', tname)
      .order('ordinal_position');
    const cols = (colsR.data||[]).map(c => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable, def: c.column_default }));
    const catIdCols = cols.filter(c => c.name.toLowerCase() === 'category_id');
    if (catIdCols.length) {
      console.log('\n--', tname, '-- columns:');
      for (const c of cols) console.log('   ', JSON.stringify(c));
      for (const col of catIdCols) {
        const refR = await supabase.from(tname).select(col.name).in(col.name, preservedIds);
        const rows = refR.data || [];
        console.log('   ', tname + '.' + col.name, '->', rows.length, 'rows reference the 3 preserved category ids');
        if (rows.length) {
          for (const r of rows.slice(0,8)) console.log('       ', JSON.stringify(r));
        }
      }
    }
  }

  // product_variants + inventory columns
  console.log('\n=== product_variants columns ===');
  const pvR = await supabase.from('information_schema.columns')
    .select('column_name,data_type').eq('table_schema','public').eq('table_name','product_variants')
    .order('ordinal_position');
  for (const c of (pvR.data||[])) console.log(JSON.stringify(c));

  console.log('\n=== inventory columns ===');
  const invR = await supabase.from('information_schema.columns')
    .select('column_name,data_type').eq('table_schema','public').eq('table_name','inventory')
    .order('ordinal_position');
  for (const c of (invR.data||[])) console.log(JSON.stringify(c));

  // products with NULL category_id
  const nullCatR = await supabase.from('products').select('id, category_id').is_('category_id', null);
  console.log('\n=== products with NULL category_id:', (nullCatR.data||[]).length, 'rows ===');
  for (const p of (nullCatR.data||[])) console.log(JSON.stringify(p));

  // referential integrity spot-check
  const allProdsR = await supabase.from('products').select('id, category_id').order('created_at');
  const catsR = await supabase.from('categories').select('id');
  const catIds = new Set((catsR.data||[]).map(c=>c.id));
  const orphans = (allProdsR.data||[]).filter(p => p.category_id && !catIds.has(p.category_id));
  console.log('\n=== products whose category_id does NOT match any categories.id (orphans):', orphans.length, '===')
  for (const o of orphans) console.log(JSON.stringify(o));

  // categories constraints
  const catConstrR = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_schema','public').eq('table_name','categories');
  console.log('\n=== categories table_constraints ===');
  for (const c of (catConstrR.data||[])) console.log(JSON.stringify(c));

  const catKeysR = await supabase
    .from('information_schema.key_column_usage')
    .select('constraint_name, column_name, ordinal_position')
    .eq('table_schema','public').eq('table_name','categories')
    .order('ordinal_position');
  console.log('\n=== categories key_column_usage ===');
  for (const c of (catKeysR.data||[])) console.log(JSON.stringify(c));

  // products constraints
  const prodConstrR = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_schema','public').eq('table_name','products');
  console.log('\n=== products table_constraints ===');
  for (const c of (prodConstrR.data||[])) console.log(JSON.stringify(c));

  const prodKeysR = await supabase
    .from('information_schema.key_column_usage')
    .select('constraint_name, column_name, ordinal_position')
    .eq('table_schema','public').eq('table_name','products')
    .order('ordinal_position');
  console.log('\n=== products key_column_usage ===');
  for (const c of (prodKeysR.data||[])) console.log(JSON.stringify(c));

  // all columns named category_id across all tables (potential FK to categories)
  const fkColsR = await supabase
    .from('information_schema.key_column_usage')
    .select('table_name, constraint_name, column_name, ordinal_position')
    .eq('table_schema','public');
  const fkCols = fkColsR.data || [];
  const catFkCols = fkCols.filter(c => c.column_name.toLowerCase() === 'category_id');
  console.log('\n=== columns named category_id across all tables (potential FK to categories) ===');
  const seen = new Set();
  for (const c of catFkCols) {
    const key = c.table_name + '.' + c.column_name;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(JSON.stringify({ table: c.table_name, column: c.column_name, constraint: c.constraint_name }));
  }

  // any column whose name contains "category"
  const catRefCols = fkCols.filter(c => /category/i.test(c.column_name));
  console.log('\n=== columns whose name contains "category" across all tables ===');
  const seen2 = new Set();
  for (const c of catRefCols) {
    const key = c.table_name + '.' + c.column_name;
    if (seen2.has(key)) continue;
    seen2.add(key);
    console.log(JSON.stringify({ table: c.table_name, column: c.column_name, constraint: c.constraint_name }));
  }

  // Also: verify the categories policies via information_schema.policies
  const polR = await supabase
    .from('information_schema.policies')
    .select('table_name, policy_name, action, permissive, roles, command, enabled')
    .eq('table_schema','public').eq('table_name','categories');
  console.log('\n=== categories RLS policies ===');
  for (const p of (polR.data||[])) console.log(JSON.stringify(p));

  const prodPolR = await supabase
    .from('information_schema.policies')
    .select('table_name, policy_name, action, permissive, roles, command, enabled')
    .eq('table_schema','public').eq('table_name','products');
  console.log('\n=== products RLS policies ===');
  for (const p of (prodPolR.data||[])) console.log(JSON.stringify(p));
}

run().catch(function(err){ console.error(err); process.exit(1); });
