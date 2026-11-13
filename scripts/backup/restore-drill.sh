#!/usr/bin/env bash
# AB Tech — local restore rehearsal. Synthetic data only; never touches Supabase.
#
# Usage:
#   BACKUP_PG_BIN=/path/to/postgresql/16/bin scripts/backup/restore-drill.sh [--keep]
#
# Proves, end to end:
#   1. migrations 0001..0007 replay on a clean database (with platform stubs)
#   2. the synthetic fixture satisfies every check in verify.sh
#   3. backup.sh produces a signed, consistent public+auth dump
#   4. the dump restores into a fresh database and matches the manifest exactly
#   5. verify.sh catches a deleted row and a tampered manifest
set -Eeuo pipefail
shopt -s inherit_errexit 2>/dev/null || true
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

DRILL_ROOT=${DRILL_ROOT:-/tmp/racine-drill}
PORT=${DRILL_PORT:-55432}
KEEP=0
HMAC_KEY=${DRILL_HMAC_KEY:-drill-only-manifest-key}

while (($#)); do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --help|-h) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "${BACKUP_PG_BIN:-}" ] || die "set BACKUP_PG_BIN to a PostgreSQL 16 bin directory"
for c in initdb postgres psql pg_dump pg_restore pg_isready createdb pg_ctl; do
  [ -x "$BACKUP_PG_BIN/$c" ] || die "missing $BACKUP_PG_BIN/$c"
done

# Refuse to delete anything that is not obviously ours, before touching disk.
guard_drill_root "$DRILL_ROOT"

step() { printf '\n=== %s\n' "$*"; }
cleanup() {
  cluster_stop "$DRILL_ROOT"
  if [ "$KEEP" -eq 0 ]; then
    rm -rf -- "$DRILL_ROOT"
  else
    log "keeping cluster at $DRILL_ROOT (stop it with: $BACKUP_PG_BIN/pg_ctl -D $DRILL_ROOT/pgdata -m immediate stop)"
  fi
}
trap cleanup EXIT

rm -rf -- "$DRILL_ROOT"
mark_drill_root "$DRILL_ROOT"

step "1/8 initialise throwaway cluster on 127.0.0.1:$PORT"
cluster_start "$DRILL_ROOT" "$PORT"

SOURCE_URL="postgresql://postgres@127.0.0.1:$PORT/racine_drill"
RESTORE_URL="postgresql://postgres@127.0.0.1:$PORT/racine_restore"
psql_source() { pg psql "$SOURCE_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }
psql_restore() { pg psql "$RESTORE_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }

step "2/8 create source database with platform stubs and schema"
pg createdb -h 127.0.0.1 -p "$PORT" -U postgres racine_drill
psql_source -f "$SCRIPT_DIR/drill-roles.sql"
psql_source -f "$SCRIPT_DIR/drill-platform.sql"
for m in "$REPO_ROOT"/supabase/migrations/*.sql; do
  printf '  applying %s\n' "$(basename "$m")"
  psql_source -f "$m"
done

step "3/8 load synthetic fixture"
psql_source -f "$SCRIPT_DIR/synthetic-fixture.sql"
psql_source -At -c "select 'source rows: products=' || (select count(*) from public.products)
  || ' orders=' || (select count(*) from public.orders)
  || ' order_items=' || (select count(*) from public.order_items)
  || ' auth.users=' || (select count(*) from auth.users)"

step "4/8 run backup.sh (plaintext rehearsal mode, HMAC-signed manifest)"
BACKUP_DIR="$DRILL_ROOT/backups" \
BACKUP_DB_URL="$SOURCE_URL" \
BACKUP_ALLOW_PLAINTEXT=1 \
BACKUP_MANIFEST_HMAC_KEY="$HMAC_KEY" \
BACKUP_PG_BIN="$BACKUP_PG_BIN" \
  "$SCRIPT_DIR/backup.sh" --local-drill --skip-storage

DUMPS=$(find "$DRILL_ROOT/backups/daily" -mindepth 1 -maxdepth 1 -type d | sort | tail -1)
[ -n "$DUMPS" ] || die "no backup directory produced"
MANIFEST="$DUMPS/manifest.txt"
[ -f "$MANIFEST" ] || die "no manifest produced"
[ -f "$MANIFEST.sig" ] || die "manifest is not signed"
ARCHIVE=$(awk '$1=="dump_archive"{print $2}' "$MANIFEST")
echo "  manifest: $MANIFEST"
echo "  archive : $ARCHIVE ($(stat -c %s "$DUMPS/$ARCHIVE") bytes)"

step "5/8 restore into a clean database"
pg createdb -h 127.0.0.1 -p "$PORT" -U postgres racine_restore
psql_restore -f "$SCRIPT_DIR/drill-roles.sql"
psql_restore -f "$SCRIPT_DIR/drill-restore.sql"

# The dump carries CREATE SCHEMA public/auth; both already exist. Drop just
# those two TOC entries instead of restoring with --clean.
TOC="$DRILL_ROOT/restore.toc"
pg pg_restore --list "$DUMPS/$ARCHIVE" | grep -vE 'SCHEMA - (public|auth)' > "$TOC"
pg pg_restore --no-owner --no-privileges --exit-on-error --use-list "$TOC" \
  --dbname "$RESTORE_URL" "$DUMPS/$ARCHIVE"

step "6/8 re-apply API grants and verify the restore"
psql_restore -f "$SCRIPT_DIR/post-restore.sql"
BACKUP_MANIFEST_HMAC_KEY="$HMAC_KEY" "$SCRIPT_DIR/verify.sh" --db-url "$RESTORE_URL" \
  --manifest "$MANIFEST" --require-signed --check-grants

step "7/8 negative control: a deleted row must fail verification"
psql_restore -c "delete from public.order_items where order_id = 'd0000000-0000-4000-8000-000000000003'"
if BACKUP_MANIFEST_HMAC_KEY="$HMAC_KEY" "$SCRIPT_DIR/verify.sh" --db-url "$RESTORE_URL" \
     --manifest "$MANIFEST" --require-signed >"$DRILL_ROOT/tamper.log" 2>&1; then
  die "verification passed after deleting a row — the checks are vacuous"
fi
grep '^FAIL' "$DRILL_ROOT/tamper.log" | sed 's/^/  detected /'

step "8/8 negative control: an edited manifest must fail its signature"
cp "$MANIFEST" "$DRILL_ROOT/manifest-orig.txt"
sed -i 's/^rowcount order_items .*/rowcount order_items 0/' "$MANIFEST"
if BACKUP_MANIFEST_HMAC_KEY="$HMAC_KEY" "$SCRIPT_DIR/verify.sh" --db-url "$RESTORE_URL" \
     --manifest "$MANIFEST" --require-signed >"$DRILL_ROOT/sig.log" 2>&1; then
  die "verification passed with a tampered manifest — signature check is broken"
fi
grep -E '^FAIL.*(HMAC|signature)' "$DRILL_ROOT/sig.log" | sed 's/^/  detected /'
cp "$DRILL_ROOT/manifest-orig.txt" "$MANIFEST"

echo
echo "RESULT: drill PASSED (signed backup, exact restore, tamper + signature checks)"
echo "        cluster: $DRILL_ROOT ($([ "$KEEP" -eq 1 ] && echo kept || echo "removed on exit"))"
