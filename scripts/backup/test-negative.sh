#!/usr/bin/env bash
# AB Tech — negative tests for the backup scripts. Local, synthetic, disposable.
#
#   BACKUP_PG_BIN=/path/to/postgresql/16/bin scripts/backup/test-negative.sh [--keep]
#
# Every case asserts the *unsafe* behaviour is refused or detected. Nothing here
# talks to Supabase, uploads anything, or installs a schedule.
set -Eeuo pipefail
shopt -s inherit_errexit 2>/dev/null || true
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

ROOT=${NEGATIVE_ROOT:-/tmp/racine-negatives}
PORT=${NEGATIVE_PORT:-55433}
KEEP=0
PASSES=0
FAILS=0

while (($#)); do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --help|-h) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "${BACKUP_PG_BIN:-}" ] || die "set BACKUP_PG_BIN to a PostgreSQL 16 bin directory"
guard_drill_root "$ROOT"

ok()   { PASSES=$((PASSES + 1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAILS=$((FAILS + 1));  printf 'FAIL  %s\n' "$1"; }
expect_refused() { # $1 description, rest = command
  local desc=$1; shift
  if "$@" >"$ROOT/last.out" 2>&1; then bad "NOT refused: $desc"; else ok "refused: $desc"; fi
}
expect_accepted() {
  local desc=$1; shift
  if "$@" >"$ROOT/last.out" 2>&1; then ok "accepted: $desc"; else bad "unexpectedly failed: $desc"; cat "$ROOT/last.out" >&2; fi
}

cleanup() {
  cluster_stop "$ROOT"
  [ "$KEEP" -eq 0 ] && rm -rf -- "$ROOT"
  return 0
}
trap cleanup EXIT

rm -rf -- "$ROOT"
mark_drill_root "$ROOT"
mkdir -p "$ROOT/fakebin"

step() { printf '\n=== %s\n' "$*"; }

DB="postgresql://postgres@127.0.0.1:$PORT/racine_negative"
BASE_ENV=(BACKUP_DB_URL="$DB" BACKUP_ALLOW_PLAINTEXT=1 BACKUP_MANIFEST_HMAC_KEY=negative-test-key BACKUP_PG_BIN="$BACKUP_PG_BIN")

step "cluster + schema for the cases that need a database"
cluster_start "$ROOT" "$PORT"
pg createdb -h 127.0.0.1 -p "$PORT" -U postgres racine_negative
 pg psql -q -X -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/drill-roles.sql" "$DB"
 pg psql -q -X -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/drill-platform.sql" "$DB"
for m in "$REPO_ROOT"/supabase/migrations/*.sql; do pg psql -q -X -v ON_ERROR_STOP=1 -f "$m" "$DB" >/dev/null 2>&1; done
 pg psql -q -X -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/synthetic-fixture.sql" "$DB"

step "1 guard matrix"
expect_refused "remote host without --confirm-production" \
  env BACKUP_DB_URL='postgresql://u:p@db.example.supabase.co:5432/postgres' "$SCRIPT_DIR/backup.sh"
expect_refused "--confirm-production together with --local-drill" \
  env BACKUP_DB_URL="$DB" "$SCRIPT_DIR/backup.sh" --confirm-production --local-drill
expect_refused "loopback plaintext without BACKUP_ALLOW_PLAINTEXT" \
  env -u BACKUP_ALLOW_PLAINTEXT BACKUP_DB_URL="$DB" BACKUP_PG_BIN="$BACKUP_PG_BIN" "$SCRIPT_DIR/backup.sh" --local-drill
expect_refused "insufficient free space" \
  env "${BASE_ENV[@]}" BACKUP_MIN_FREE_MB=99999999 BACKUP_DIR="$ROOT/b1" "$SCRIPT_DIR/backup.sh" --local-drill

step "2 a failing encryptor must not publish anything"
printf '#!/bin/sh\nout=""; prev=""; for a in "$@"; do [ "$prev" = "--output" ] && out="$a"; prev="$a"; done\nprintf partial > "$out"; echo "age: failed mid-write" >&2; exit 1\n' > "$ROOT/fakebin/age"
chmod +x "$ROOT/fakebin/age"
expect_refused "encryptor writes 7 bytes then exits 1" \
  env "${BASE_ENV[@]}" BACKUP_DIR="$ROOT/b2" BACKUP_AGE_RECIPIENT=age1fakerecipient PATH="$ROOT/fakebin:$PATH" \
  "$SCRIPT_DIR/backup.sh" --local-drill --skip-storage
if find "$ROOT/b2" -name '*.age' -o -name '*.dump' 2>/dev/null | grep -q .; then
  bad "a partial archive or plaintext dump was left behind"
else
  ok "no archive or plaintext left after the encryption failure"
fi
if find "$ROOT/b2" -name 'manifest*' 2>/dev/null | grep -q .; then
  bad "a manifest was published for a failed backup"
else
  ok "no manifest published for a failed backup"
fi

step "3 the drill must not delete a directory it did not create"
mkdir -p "$ROOT/not-ours"
echo 'do not delete' > "$ROOT/not-ours/invoice.txt"
expect_refused "unmarked DRILL_ROOT is refused" \
  env DRILL_ROOT="$ROOT/not-ours" "$SCRIPT_DIR/restore-drill.sh"
[ -f "$ROOT/not-ours/invoice.txt" ] && ok "canary file survived" || bad "drill deleted a directory it did not create"

step "4 retention keeps exactly the configured number"
for _ in 1 2 3 4; do
  env "${BASE_ENV[@]}" BACKUP_DIR="$ROOT/b4" BACKUP_RETENTION_DAILY=1 \
    "$SCRIPT_DIR/backup.sh" --local-drill --skip-storage >/dev/null 2>&1
  sleep 1
done
count=$(find "$ROOT/b4/daily" -mindepth 1 -maxdepth 1 -type d | wc -l)
[ "$count" -eq 1 ] && ok "4 runs with RETENTION_DAILY=1 left 1 backup" || bad "retention left $count backups (expected 1)"
newest=$(find "$ROOT/b4/daily" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -1)
[ -f "$ROOT/b4/daily/$newest/manifest.txt" ] && ok "the newest backup survived pruning" || bad "newest backup was pruned"

step "5 an edited manifest must fail its signature"
MAN="$ROOT/b4/daily/$newest/manifest.txt"
sed -i 's/^rowcount order_items .*/rowcount order_items 0/' "$MAN"
expect_refused "verify with a tampered HMAC manifest" \
  env BACKUP_MANIFEST_HMAC_KEY=negative-test-key "$SCRIPT_DIR/verify.sh" \
  --db-url "$DB" --manifest "$MAN" --require-signed
grep -q '^FAIL.*HMAC' "$ROOT/last.out" && ok "HMAC mismatch reported" || bad "HMAC mismatch not reported"

step "6 a corrupted archive must fail its hash check"
ARCHIVE=$(awk '$1=="dump_archive"{print $2}' "$ROOT/b4/daily/$newest/manifest.txt" 2>/dev/null || true)
cp "$ROOT/b4/daily/$newest/manifest.txt" "$ROOT/m.txt"
printf 'corrupted' > "$ROOT/$ARCHIVE"
expect_refused "verify with a corrupted archive" \
  env BACKUP_MANIFEST_HMAC_KEY=negative-test-key "$SCRIPT_DIR/verify.sh" \
  --db-url "$DB" --manifest "$ROOT/m.txt" --dump "$ROOT/$ARCHIVE"
grep -q '^FAIL.*does not match manifest' "$ROOT/last.out" && ok "archive hash mismatch reported" || bad "archive hash mismatch not reported"

step "7 a stale lock is reclaimed, a live one is respected"
mkdir -p "$ROOT/b7/.lock"; touch -d '5 hours ago' "$ROOT/b7/.lock"
expect_accepted "stale lock reclaimed" \
  env "${BASE_ENV[@]}" BACKUP_DIR="$ROOT/b7" BACKUP_LOCK_STALE_MINUTES=180 \
  "$SCRIPT_DIR/backup.sh" --local-drill --skip-storage
"$SCRIPT_DIR/backup.sh" --help >/dev/null 2>&1 || true
mkdir -p "$ROOT/b8/.lock"
expect_refused "fresh lock respected" \
  env "${BASE_ENV[@]}" BACKUP_DIR="$ROOT/b8" "$SCRIPT_DIR/backup.sh" --local-drill --skip-storage

echo
echo "negative tests: passed=$PASSES failed=$FAILS"
[ "$FAILS" -eq 0 ] || exit 1
echo "result: PASS"
