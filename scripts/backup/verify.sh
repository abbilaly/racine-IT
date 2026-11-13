#!/usr/bin/env bash
# AB Tech — integrity checks for a backup restore (or a chosen database).
#
# Usage:
#   scripts/backup/verify.sh --db-url postgres://...
#   scripts/backup/verify.sh --db-url ... --manifest manifest.txt [--dump archive.age]
#   scripts/backup/verify.sh --db-url ... --storage-dir ./storage [--check-grants]
#
# A manifest is only trusted when its signature verifies:
#   manifest.txt.asc  -> gpg detached signature (BACKUP_MANIFEST_SIGN_KEY signer)
#   manifest.txt.sig  -> HMAC-SHA256 with BACKUP_MANIFEST_HMAC_KEY
# An unsigned manifest is reported loudly and counts as a failure if
# --require-signed is passed.
#
# Exit code 0 = every check passed, 1 = at least one failed.
set -Eeuo pipefail
shopt -s inherit_errexit 2>/dev/null || true

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

DB_URL=""
SAFE_URL=""
MANIFEST=""
DUMP=""
STORAGE_DIR=""
ALLOW_REMOTE=0
CHECK_GRANTS=0
REQUIRE_SIGNED=0
FAILURES=0
CHECKS=0

usage() { sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0; }
while (($#)); do
  case "$1" in
    --help|-h) usage ;;
    --db-url) DB_URL=${2:-}; [ -n "$DB_URL" ] || die "--db-url needs a value"; shift 2 ;;
    --manifest) MANIFEST=${2:-}; [ -n "$MANIFEST" ] || die "--manifest needs a value"; shift 2 ;;
    --dump) DUMP=${2:-}; [ -n "$DUMP" ] || die "--dump needs a value"; shift 2 ;;
    --storage-dir) STORAGE_DIR=${2:-}; [ -n "$STORAGE_DIR" ] || die "--storage-dir needs a value"; shift 2 ;;
    --allow-remote) ALLOW_REMOTE=1; shift ;;
    --check-grants) CHECK_GRANTS=1; shift ;;
    --require-signed) REQUIRE_SIGNED=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$DB_URL" ] || die "--db-url is required"
require_pg_bin

# Keep the password out of argv, as backup.sh does.
urldecode() { printf '%b' "${1//%/\\x}"; }
SAFE_URL=$DB_URL
if [[ $DB_URL =~ ^([a-zA-Z0-9+]+)://([^@/]+)@(.*)$ ]]; then
  prefix=${BASH_REMATCH[1]}; creds=${BASH_REMATCH[2]}; rest=${BASH_REMATCH[3]}
  if [[ $creds == *:* ]]; then
    PGPASSWORD=$(urldecode "${creds#*:}"); export PGPASSWORD
    SAFE_URL="$prefix://${creds%%:*}@$rest"
  fi
fi

HOST=$(printf '%s' "$SAFE_URL" | sed -E 's#^[a-z0-9+]+://([^@/]*@)?([^/:?]+).*#\2#')
case "$HOST" in
  localhost|127.0.0.1|::1|"[::1]") : ;;
  *) [ "$ALLOW_REMOTE" -eq 1 ] || die "refusing to run against remote host '$HOST' without --allow-remote" ;;
esac

q() { pg psql "$SAFE_URL" -At -X -v ON_ERROR_STOP=1 -c "$1"; }
pass() { CHECKS=$((CHECKS + 1)); printf 'PASS  %s\n' "$1"; }
fail() { CHECKS=$((CHECKS + 1)); FAILURES=$((FAILURES + 1)); printf 'FAIL  %s\n' "$1"; }
note() { printf '      %s\n' "$1"; }

scalar_is() {
  local got
  got=$(q "$2" 2>/dev/null || echo "query-error")
  if [ "$got" = "$3" ]; then pass "$1 ($got)"; else fail "$1 (expected $3, got $got)"; fi
}
scalar_positive() {
  local got
  got=$(q "$2" 2>/dev/null || echo "query-error")
  if [ "$got" -gt 0 ] 2>/dev/null; then pass "$1 ($got)"; else fail "$1 (expected >0, got $got)"; fi
}

# --- manifest authenticity --------------------------------------------------
if [ -n "$MANIFEST" ]; then
  [ -f "$MANIFEST" ] || die "manifest not found: $MANIFEST"
  echo "== manifest authenticity"
  if [ -f "$MANIFEST.asc" ]; then
    need gpg
    if gpg --batch --verify "$MANIFEST.asc" "$MANIFEST" >/dev/null 2>&1; then
      pass "manifest gpg signature verifies"
    else
      fail "manifest gpg signature does NOT verify (manifest replaced or tampered)"
    fi
  elif [ -f "$MANIFEST.sig" ]; then
    if [ -z "${BACKUP_MANIFEST_HMAC_KEY:-}" ]; then
      fail "manifest is HMAC-signed but BACKUP_MANIFEST_HMAC_KEY is not set — cannot trust it"
    else
      need openssl
      expected=$(cat "$MANIFEST.sig")
      actual=$(openssl dgst -sha256 -hmac "$BACKUP_MANIFEST_HMAC_KEY" -r "$MANIFEST" | cut -d' ' -f1)
      if [ "$expected" = "$actual" ]; then pass "manifest HMAC verifies"
      else fail "manifest HMAC does NOT verify (manifest replaced or tampered)"; fi
    fi
  else
    if [ "$REQUIRE_SIGNED" -eq 1 ]; then fail "manifest is unsigned (--require-signed)"
    else note "WARNING: manifest is unsigned — row counts cannot be trusted against tampering"; fi
  fi
fi

# --- archived dump integrity ------------------------------------------------
if [ -n "$DUMP" ]; then
  echo "== archive integrity"
  [ -f "$DUMP" ] || die "dump not found: $DUMP"
  [ -f "$MANIFEST" ] || die "--dump requires --manifest"
  line=$(grep -E '^(dump|storage)_archive ' "$MANIFEST" | grep -F "$(basename "$DUMP")" || true)
  if [ -z "$line" ]; then
    fail "manifest has no entry for $(basename "$DUMP")"
  else
    want_sha=$(printf '%s\n' "$line" | sed -nE 's/.* sha256=([0-9a-f]+).*/\1/p')
    want_bytes=$(printf '%s\n' "$line" | sed -nE 's/.* bytes=([0-9]+).*/\1/p')
    got_sha=$(sha256sum "$DUMP" | cut -d' ' -f1)
    got_bytes=$(stat -c %s "$DUMP")
    if [ "$got_sha" = "$want_sha" ] && [ "$got_bytes" = "$want_bytes" ]; then
      pass "$(basename "$DUMP") matches manifest sha256 and size"
    else
      fail "$(basename "$DUMP") does not match manifest (sha256 or size changed)"
    fi
  fi
fi

echo "== row counts"
for t in categories products product_variants product_images inventory store_settings orders order_items brands suppliers quotations quotation_lines stock_adjustments admin_notes admin_roles email_log email_events email_suppressions followup_jobs followup_rules supplier_sync_logs; do
  exists=$(q "select to_regclass('public.$t') is not null" 2>/dev/null || echo f)
  [ "$exists" = t ] || continue
  note "$(printf '%-22s %s' "$t" "$(q "select count(*) from public.$t")")"
done
if [ "$(q "select to_regclass('auth.users') is not null" 2>/dev/null || echo f)" = t ]; then
  note "$(printf '%-22s %s' "auth.users" "$(q 'select count(*) from auth.users')")"
fi

echo "== table presence and shape"
for t in categories products product_images inventory orders order_items store_settings; do
  scalar_is "table $t exists" "select to_regclass('public.$t') is not null" t
done
scalar_is "store_settings holds exactly one row" "select count(*) from public.store_settings" 1
scalar_positive "auth.users is not empty" "select count(*) from auth.users"

echo "== referential integrity"
scalar_is "order_items without a parent order" \
  "select count(*) from public.order_items oi left join public.orders o on o.id = oi.order_id where o.id is null" 0
scalar_is "order_items without a product (product was deleted)" \
  "select count(*) from public.order_items oi left join public.products p on p.id = oi.product_id where oi.product_id is not null and p.id is null" 0
scalar_is "products with an unknown category" \
  "select count(*) from public.products p left join public.categories c on c.id = p.category_id where c.id is null" 0
scalar_is "inventory rows with an unknown product" \
  "select count(*) from public.inventory i left join public.products p on p.id = i.product_id where p.id is null" 0
scalar_is "product images with an unknown product" \
  "select count(*) from public.product_images pi left join public.products p on p.id = pi.product_id where p.id is null" 0
scalar_is "orders pointing at a missing auth user" \
  "select count(*) from public.orders o left join auth.users u on u.id = o.user_id where o.user_id is not null and u.id is null" 0
scalar_is "admin_roles pointing at a missing auth user" \
  "select count(*) from public.admin_roles r left join auth.users u on u.id = r.user_id where u.id is null" 0

echo "== business invariants"
scalar_is "orders where item_count disagrees with the item rows" \
  "select count(*) from (select o.id from public.orders o join public.order_items oi on oi.order_id = o.id group by o.id, o.item_count having o.item_count <> sum(oi.qty)) t" 0
scalar_is "orders where total <> subtotal + shipping" \
  "select count(*) from public.orders where total <> subtotal + shipping" 0
scalar_is "orders where the line totals do not add up" \
  "select count(*) from (select o.id from public.orders o join public.order_items oi on oi.order_id = o.id group by o.id, o.subtotal having o.subtotal <> sum(oi.line_total)) t" 0
scalar_is "negative inventory on_hand" "select count(*) from public.inventory where on_hand < 0" 0
scalar_is "duplicate order refs" "select count(*)-count(distinct ref) from public.orders" 0
scalar_is "orders with a malformed ref" "select count(*) from public.orders where ref !~ '^RIT-[A-Z0-9]{8}\$'" 0
scalar_is "products with a negative price" "select count(*) from public.products where price_cents < 0" 0

if [ "$CHECK_GRANTS" -eq 1 ]; then
  echo "== application grants"
  scalar_is "anon can select products" "select has_table_privilege('anon','public.products','SELECT')" t
  scalar_is "authenticated can select products" "select has_table_privilege('authenticated','public.products','SELECT')" t
  scalar_is "service_role can select orders" "select has_table_privilege('service_role','public.orders','SELECT')" t
fi

if [ -n "$MANIFEST" ]; then
  echo "== manifest comparison"
  while read -r kind name expected; do
    [ "$kind" = rowcount ] || continue
    if [ "$name" = auth.users ]; then actual=$(q 'select count(*) from auth.users'); else actual=$(q "select count(*) from public.$name"); fi
    if [ "$actual" = "$expected" ]; then pass "count $name matches backup ($actual)"
    else fail "count $name differs from backup (backup $expected, now $actual)"; fi
  done < "$MANIFEST"
fi

if [ -n "$STORAGE_DIR" ]; then
  echo "== storage objects"
  if [ ! -d "$STORAGE_DIR" ]; then
    fail "storage dir missing: $STORAGE_DIR"
  else
    files=$(find "$STORAGE_DIR" -type f | wc -l | tr -d ' ')
    bytes=$(find "$STORAGE_DIR" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
    note "files=$files bytes=$bytes"
    if [ -n "$MANIFEST" ]; then
      exp_files=$(awk '$1=="storage_objects"{print $2}' "$MANIFEST")
      exp_bytes=$(awk '$1=="storage_bytes"{print $2}' "$MANIFEST")
      if [ -n "$exp_files" ] && [ "$files" = "$exp_files" ]; then pass "storage object count matches backup ($files)"
      elif [ -n "$exp_files" ]; then fail "storage object count differs (backup $exp_files, now $files)"; fi
      if [ -n "$exp_bytes" ] && [ "$bytes" = "$exp_bytes" ]; then pass "storage byte total matches backup ($bytes)"
      elif [ -n "$exp_bytes" ]; then fail "storage byte total differs (backup $exp_bytes, now $bytes)"; fi
    fi
  fi
fi

echo
echo "checks=$CHECKS failures=$FAILURES"
[ "$FAILURES" -eq 0 ] || exit 1
echo "result: PASS"
