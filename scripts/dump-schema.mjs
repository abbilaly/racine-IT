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
if (!url || !key) { console.error('Missing env'); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1) table existence + full DDL via pg_catalog (server-side, no RLS exposure issues)
  const tables = await supabase.rpc('pg_get_table_ddl', { p_schema: 'public', p_table: 'categories' }).catch(() => null);
  console.log('=== categories DDL (pg_get_table_ddl) ===');
  console.log(JSON.stringify(tables?.data ?? tables));
  const productsDdl = await supabase.rpc('pg_get_table_ddl', { p_schema: 'public', p_table: 'products' }).catch(() => null);
  console.log('\n=== products DDL (pg_get_table_ddl) ===');
  console.log(JSON.stringify(productsDdl?.data ?? productsDdl));

  // 2) explicit column set for categories (nullable + defaults + pk)
  const catCols = await supabase
    .from('information_schema.columns')
    .select('column_name,data_type,is_nullable,column_default,character_maximum_length,numeric_precision')
    .eq('table_schema', 'public')
    .eq('table_name', 'categories')
    .order('ordinal_position');
  console.log('\n=== categories.columns ===');
  console.log(JSON.stringify(catCols.data));

  // 3) FKs targeting categories + originating from products
  const catPk = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name,constraint_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'categories')
    .eq('constraint_type', 'PRIMARY KEY');
  console.log('\n=== categories.PK ===');
  console.log(JSON.stringify(catPk.data));

  const prodFk = await supabase
    .from('information_schema.key_column_usage')
    .select('table_name,column_name,constraint_name,ordinal_position')
    .eq('table_schema', 'public')
    .in('table_name', ['products'])
    .order('ordinal_position');
  console.log('\n=== products.key_column_usage (incl FK cols) ===');
  console.log(JSON.stringify(prodFk.data));

  // 4) indexes / constraints referencing category_id
  const prodConstr = await supabase
    .from('information_schema.table_constraints')
    .select('table_name,constraint_name,constraint_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'products');
  console.log('\n=== products.constraints ===');
  console.log(JSON.stringify(prodConstr.data));

  // 5) RLS on categories + products
  const rls = await supabase
    .from('information_schema.policies')
    .select('table_name,policy_name,action,permissive,roles,command,enabled')
    .eq('table_schema', 'public')
    .in('table_name', ['categories', 'products']);
  console.log('\n=== RLS policies (categories, products) ===');
  console.log(JSON.stringify(rls.data));
}

main().catch(err => { console.error(err); process.exit(1); });
