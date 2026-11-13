#!/usr/bin/env bash
# AB Tech — nightly logical backup for the Supabase project.
#
# SAFE BY DEFAULT: plan only. Nothing is dumped, encrypted, uploaded or deleted
# without --confirm-production (or --local-drill, which is for the rehearsal).
#
# Usage:
#   scripts/backup/backup.sh --dry-run                 # plan (default)
#   scripts/backup/backup.sh --confirm-production      # real nightly run
#   scripts/backup/backup.sh --local-drill             # synthetic rehearsal only
#
# Required env : BACKUP_DB_URL
# Encryption   : BACKUP_AGE_RECIPIENT (preferred) or BACKUP_GPG_RECIPIENT.
#                Plaintext is only possible with --local-drill and
#                BACKUP_ALLOW_PLAINTEXT=1.
# Manifest auth: BACKUP_MANIFEST_HMAC_KEY, or BACKUP_MANIFEST_SIGN_KEY (gpg).
set -Eeuo pipefail
shopt -s inherit_errexit 2>/dev/null || true
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=${BACKUP_DIR:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/abtech-backups}
RETENTION_DAILY=${BACKUP_RETENTION_DAILY:-7}
RETENTION_WEEKLY=${BACKUP_RETENTION_WEEKLY:-4}
RETENTION_MONTHLY=${BACKUP_RETENTION_MONTHLY:-12}
MIN_FREE_MB=${BACKUP_MIN_FREE_MB:-512}
LOCK_STALE_MIN=${BACKUP_LOCK_STALE_MINUTES:-180}
DB_URL=${BACKUP_DB_URL:-}
OFFSITE=${BACKUP_OFFSITE:-}
STORAGE_REMOTE=${BACKUP_STORAGE_REMOTE:-}
AGE_RECIPIENT=${BACKUP_AGE_RECIPIENT:-}
GPG_RECIPIENT=${BACKUP_GPG_RECIPIENT:-}
HMAC_KEY=${BACKUP_MANIFEST_HMAC_KEY:-}
SIGN_KEY=${BACKUP_MANIFEST_SIGN_KEY:-}

PLAN_ONLY=1
CONFIRM_SEEN=0
DRILL_SEEN=0
WITH_STORAGE=1
PUBLISHED=0
WORK=""
CURRENT_DEST=""
PLAIN=""
ARCHIVE=""
LOCK=""

usage() { sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0; }

while (($#)); do
  case "$1" in
    --help|-h)            usage ;;
    --dry-run)            PLAN_ONLY=1 ;;
    --confirm-production) CONFIRM_SEEN=1; DRILL_SEEN=0; PLAN_ONLY=0 ;;
    --local-drill)
      [ "$CONFIRM_SEEN" -eq 1 ] && die "--confirm-production and --local-drill are mutually exclusive"
      DRILL_SEEN=1; PLAN_ONLY=0 ;;
    --skip-storage)       WITH_STORAGE=0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

[ -n "$DB_URL" ] || die "BACKUP_DB_URL is not set"

# --- credentials: keep the password out of argv (visible in ps) --------------
urldecode() { printf '%b' "${1//%/\\x}"; }

split_url() { # sets SAFE_URL, exports PGPASSWORD
  local url=$1 scheme creds rest user pass
  SAFE_URL=$url
  if [[ $url =~ ^([a-zA-Z0-9+]+)://([^@/]+)@(.*)$ ]]; then
    scheme=${BASH_REMATCH[1]}; creds=${BASH_REMATCH[2]}; rest=${BASH_REMATCH[3]}
    if [[ $creds == *:* ]]; then
      user=${creds%%:*}; pass=${creds#*:}
      PGPASSWORD=$(urldecode "$pass"); export PGPASSWORD
      SAFE_URL="$scheme://$user@$rest"
    fi
  fi
}

url_host() {
  case "$1" in
    *host=%2F*|*host=/*) printf 'localhost'; return 0 ;;
  esac
  printf '%s' "$1" | sed -E 's#^[a-z0-9+]+://([^@/]*@)?([^/:?]+).*#\2#'
}
is_loopback() { case "$1" in localhost|127.0.0.1|::1|"[::1]") return 0 ;; *) return 1 ;; esac; }

split_url "$DB_URL"
DB_HOST=$(url_host "$SAFE_URL")
if is_loopback "$DB_HOST"; then HOST_KIND=loopback; else HOST_KIND=remote; fi

if [ "$HOST_KIND" = remote ] && [ "$CONFIRM_SEEN" -ne 1 ]; then
  die "refusing to back up remote host '$DB_HOST' without --confirm-production"
fi
if [ "$HOST_KIND" = loopback ] && [ "$DRILL_SEEN" -ne 1 ] && [ "$CONFIRM_SEEN" -ne 1 ]; then
  die "loopback host requires --local-drill (rehearsal) or --confirm-production"
fi

if [ "$HOST_KIND" = remote ] && [[ "$SAFE_URL" != *sslmode=* ]]; then
  case "$SAFE_URL" in
    *\?*) SAFE_URL="$SAFE_URL&sslmode=require" ;;
    *)    SAFE_URL="$SAFE_URL?sslmode=require" ;;
  esac
  log "no sslmode in URL; requiring TLS (sslmode=require)"
fi

# --- encryption policy ------------------------------------------------------
if [ -n "$AGE_RECIPIENT" ]; then ENC=age
elif [ -n "$GPG_RECIPIENT" ]; then ENC=gpg
else ENC=none; fi

if [ "$ENC" = none ] && [ "$PLAN_ONLY" -eq 0 ]; then
  if [ "$DRILL_SEEN" -ne 1 ] || [ "${BACKUP_ALLOW_PLAINTEXT:-0}" != 1 ]; then
    die "refusing to write plaintext backups: set BACKUP_AGE_RECIPIENT (preferred) or BACKUP_GPG_RECIPIENT; plaintext needs --local-drill AND BACKUP_ALLOW_PLAINTEXT=1"
  fi
  warn "plaintext rehearsal mode: dumps will NOT be encrypted"
fi

require_pg_bin
need sha256sum
need df
case "$ENC" in
  age) need age; [[ "$AGE_RECIPIENT" == age1* ]] || die "BACKUP_AGE_RECIPIENT does not look like an age recipient" ;;
  gpg) need gpg; gpg --batch --list-keys "$GPG_RECIPIENT" >/dev/null 2>&1 || die "gpg recipient '$GPG_RECIPIENT' is not in the keyring" ;;
esac
if [ -n "$SIGN_KEY" ]; then need gpg; fi
if [ -z "$SIGN_KEY" ] && [ -n "$HMAC_KEY" ]; then need openssl; fi
if [ "$WITH_STORAGE" -eq 1 ] && [ -n "$STORAGE_REMOTE" ]; then need rclone; fi
[ -n "$OFFSITE" ] && need rclone

if [ "$PLAN_ONLY" -eq 1 ]; then
  cat >&2 <<PLAN
Plan (nothing has been dumped, encrypted, uploaded or deleted):
  host            : $DB_HOST ($HOST_KIND)
  stage dir       : $BACKUP_DIR
  snapshot        : single pg_dump of public + auth (consistent)
  storage         : $([ "$WITH_STORAGE" -eq 1 ] && echo "${STORAGE_REMOTE:-no BACKUP_STORAGE_REMOTE set}" || echo "skipped")
  off-site        : ${OFFSITE:-local staging only}
  encryption      : $ENC
  manifest auth   : $([ -n "$SIGN_KEY" ] && echo "gpg signature ($SIGN_KEY)" || { [ -n "$HMAC_KEY" ] && echo "HMAC" || echo "UNSIGNED - not tamper-evident"; })
  retention       : $RETENTION_DAILY daily / $RETENTION_WEEKLY weekly / $RETENTION_MONTHLY monthly
  free space      : at least ${MIN_FREE_MB} MB required
Re-run with --confirm-production to execute.
PLAN
  exit 0
fi

# --- preconditions ----------------------------------------------------------
mkdir -p "$BACKUP_DIR" || die "cannot create $BACKUP_DIR"
FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
[ "${FREE_MB:-0}" -ge "$MIN_FREE_MB" ] || die "only ${FREE_MB:-0} MB free on $BACKUP_DIR; need ${MIN_FREE_MB} MB"

WORK="$BACKUP_DIR/.work-$STAMP"
PLAIN="$WORK/abtech.dump"

cleanup() {
  local rc=$?
  if [ -n "$PLAIN" ] && [ -f "$PLAIN" ]; then
    if [ "${PUBLISHED:-0}" -ne 1 ]; then
      warn "backup failed: wiping plaintext dump (rc=$rc)"
    fi
    shred -u -- "$PLAIN" 2>/dev/null || rm -f -- "$PLAIN"
  fi
  [ -n "$WORK" ] && rm -rf -- "$WORK"
  if [ -n "$CURRENT_DEST" ] && [ -d "$CURRENT_DEST" ] && [ ! -f "$CURRENT_DEST/manifest.txt" ]; then
    rm -rf -- "$CURRENT_DEST"
  fi
  [ -n "$LOCK" ] && rm -rf -- "$LOCK"
  exit "$rc"
}

LOCK="$BACKUP_DIR/.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  lock_age_min=0
  if [ -d "$LOCK" ]; then
    lock_age_min=$(( ($(date +%s) - $(stat -c %Y "$LOCK")) / 60 ))
    if [ "$lock_age_min" -ge "$LOCK_STALE_MIN" ]; then
      warn "removing stale lock (${lock_age_min}m old, threshold ${LOCK_STALE_MIN}m)"
      rm -rf -- "$LOCK"
    fi
  fi
  mkdir "$LOCK" 2>/dev/null || die "another backup is running (lock $LOCK, ${lock_age_min}m old)"
fi
printf '%s %s\n' "$$" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK/owner"
trap cleanup EXIT

mkdir -p "$WORK"
log "backup $STAMP starting against $DB_HOST ($HOST_KIND, encryption=$ENC)"

# Auth tables that are worthless in a backup and can be large.
AUTH_EXCLUDES=()
for t in sessions refresh_tokens flow_state mfa_amr_claims one_time_tokens audit_log_entries; do
  if pg psql "$SAFE_URL" -At -X -c "select to_regclass('auth.$t') is not null" 2>/dev/null | grep -qx t; then
    AUTH_EXCLUDES+=("--exclude-table-data=auth.$t")
  fi
done

# --- one consistent snapshot of both schemas --------------------------------
pg pg_dump "$SAFE_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth ${AUTH_EXCLUDES[@]+"${AUTH_EXCLUDES[@]}"} \
  --file="$PLAIN" || die "pg_dump failed"
[ -s "$PLAIN" ] || die "pg_dump produced an empty file"
pg pg_restore --list "$PLAIN" > "$WORK/toc.txt" 2>/dev/null || die "dump is not a readable archive"
[ -s "$WORK/toc.txt" ] || die "dump archive has an empty table of contents"
PLAIN_BYTES=$(stat -c %s "$PLAIN")

encrypt_file() { # $1 plaintext; sets ARCHIVE
  case "$ENC" in
    age) ARCHIVE="$1.age"; age --encrypt --recipient "$AGE_RECIPIENT" --output "$ARCHIVE" "$1" ;;
    gpg) ARCHIVE="$1.gpg"; gpg --batch --yes --quiet --encrypt --recipient "$GPG_RECIPIENT" --output "$ARCHIVE" "$1" ;;
    none) ARCHIVE="$1"; return 0 ;;
  esac
}

verify_ciphertext() { # $1 archive, $2 plaintext bytes
  local f=$1 bytes
  [ -s "$f" ] || return 1
  bytes=$(stat -c %s "$f")
  [ "$bytes" -ge 64 ] || return 1
  [ "$bytes" -ge $(( $2 / 2 )) ] || return 1
  case "$ENC" in
    age) head -c 22 "$f" | grep -q '^age-encryption.org/v1' || return 1 ;;
    gpg) gpg --batch --list-packets "$f" 2>/dev/null | grep -q 'encrypted data packet' || return 1 ;;
    none) : ;;
  esac
}

encrypt_file "$PLAIN" || die "encryption ($ENC) failed; plaintext wiped, nothing published"
verify_ciphertext "$ARCHIVE" "$PLAIN_BYTES" || die "encrypted archive failed verification; nothing published"
DB_ARCHIVE=$ARCHIVE
if [ "$ENC" != none ]; then
  shred -u -- "$PLAIN" 2>/dev/null || rm -f -- "$PLAIN"
fi

# --- optional storage snapshot ----------------------------------------------
STORAGE_COUNT=0
STORAGE_BYTES=0
STORAGE_ARCHIVE=""
if [ "$WITH_STORAGE" -eq 1 ] && [ -n "$STORAGE_REMOTE" ]; then
  log "copying storage objects from $STORAGE_REMOTE"
  mkdir -p "$WORK/storage"
  rclone copy "$STORAGE_REMOTE" "$WORK/storage" --metadata --checksum --log-level ERROR \
    || die "storage copy failed"
  rclone check "$STORAGE_REMOTE" "$WORK/storage" --one-way --log-level ERROR \
    || die "storage verification failed (source and copy differ)"
  STORAGE_COUNT=$(find "$WORK/storage" -type f | wc -l | tr -d ' ')
  STORAGE_BYTES=$(find "$WORK/storage" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
  tar -czf "$WORK/storage.tar.gz" -C "$WORK" storage || die "storage archive failed"
  STORAGE_PLAIN_BYTES=$(stat -c %s "$WORK/storage.tar.gz")
  encrypt_file "$WORK/storage.tar.gz" || die "storage encryption failed"
  verify_ciphertext "$ARCHIVE" "$STORAGE_PLAIN_BYTES" || die "storage archive failed verification"
  STORAGE_ARCHIVE=$ARCHIVE
  [ "$ENC" != none ] && { shred -u -- "$WORK/storage.tar.gz" 2>/dev/null || rm -f -- "$WORK/storage.tar.gz"; }
  rm -rf -- "$WORK/storage"
elif [ "$WITH_STORAGE" -eq 1 ]; then
  warn "BACKUP_STORAGE_REMOTE not set — storage objects are NOT in this backup"
fi

# --- manifest ---------------------------------------------------------------
row_counts() {
  local t n
  for t in categories products product_variants product_images inventory store_settings orders order_items brands suppliers quotations quotation_lines stock_adjustments admin_notes admin_roles email_log email_events email_suppressions followup_jobs followup_rules supplier_sync_logs; do
    if pg psql "$SAFE_URL" -At -X -c "select to_regclass('public.$t') is not null" 2>/dev/null | grep -qx t; then
      n=$(pg psql "$SAFE_URL" -At -X -c "select count(*) from public.$t")
      printf 'rowcount %s %s\n' "$t" "$n"
    fi
  done
  if pg psql "$SAFE_URL" -At -X -c "select to_regclass('auth.users') is not null" 2>/dev/null | grep -qx t; then
    printf 'rowcount auth.users %s\n' "$(pg psql "$SAFE_URL" -At -X -c 'select count(*) from auth.users')"
  fi
}

MANIFEST="$WORK/manifest.txt"
{
  echo "# AB Tech backup manifest"
  echo "version 2"
  echo "stamp $STAMP"
  echo "created_utc $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "db_host $DB_HOST"
  echo "git_commit $(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "snapshot single-pg_dump public+auth"
  echo "encryption $ENC"
  echo "dump_archive $(basename "$DB_ARCHIVE") sha256=$(sha256sum "$DB_ARCHIVE" | cut -d' ' -f1) bytes=$(stat -c %s "$DB_ARCHIVE") plaintext_bytes=$PLAIN_BYTES"
  [ -n "$STORAGE_ARCHIVE" ] && echo "storage_archive $(basename "$STORAGE_ARCHIVE") sha256=$(sha256sum "$STORAGE_ARCHIVE" | cut -d' ' -f1) bytes=$(stat -c %s "$STORAGE_ARCHIVE")"
  echo "storage_objects $STORAGE_COUNT"
  echo "storage_bytes $STORAGE_BYTES"
  row_counts
} > "$MANIFEST"

SIG=""
if [ -n "$SIGN_KEY" ]; then
  gpg --batch --yes --armor --detach-sign --local-user "$SIGN_KEY" --output "$MANIFEST.asc" "$MANIFEST" \
    || die "manifest signing failed"
  SIG="$MANIFEST.asc"
elif [ -n "$HMAC_KEY" ]; then
  openssl dgst -sha256 -hmac "$HMAC_KEY" -r "$MANIFEST" | cut -d' ' -f1 > "$MANIFEST.sig" \
    || die "manifest HMAC failed"
  SIG="$MANIFEST.sig"
else
  warn "no manifest signing key set: the manifest is not tamper-evident"
fi

# --- publish ----------------------------------------------------------------
CURRENT_DEST="$BACKUP_DIR/daily/$STAMP"
mkdir -p "$CURRENT_DEST"
install -m 600 "$DB_ARCHIVE" "$CURRENT_DEST/"
install -m 600 "$MANIFEST" "$CURRENT_DEST/"
[ -n "$SIG" ] && install -m 600 "$SIG" "$CURRENT_DEST/"
[ -n "$STORAGE_ARCHIVE" ] && install -m 600 "$STORAGE_ARCHIVE" "$CURRENT_DEST/"
PUBLISHED=1

if [ -n "$OFFSITE" ]; then
  log "uploading to $OFFSITE/daily/$STAMP"
  rclone copy "$CURRENT_DEST" "$OFFSITE/daily/$STAMP" --checksum --log-level ERROR || die "upload failed"
  rclone check "$CURRENT_DEST" "$OFFSITE/daily/$STAMP" --one-way --log-level ERROR || die "upload verification failed"
fi

promote() { # $1 tier
  local tier=$1
  mkdir -p "$BACKUP_DIR/$tier"
  cp -al "$CURRENT_DEST" "$BACKUP_DIR/$tier/$STAMP" 2>/dev/null || cp -a "$CURRENT_DEST" "$BACKUP_DIR/$tier/$STAMP"
  if [ -n "$OFFSITE" ]; then
    rclone copy "$BACKUP_DIR/$tier/$STAMP" "$OFFSITE/$tier/$STAMP" --checksum --log-level ERROR || warn "upload to $tier failed"
  fi
}
if [ "$(date -u +%u)" = 7 ]; then promote weekly || warn "weekly promotion failed"; fi
if [ "$(date -u +%d)" = 01 ]; then promote monthly || warn "monthly promotion failed"; fi

prune_tier() { # $1 dir, $2 keep
  local dir=$1 keep=$2 name i=0 after list
  [ -d "$dir" ] || return 0
  list=$(find "$dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort -r || true)
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    i=$((i + 1))
    [ "$i" -le "$keep" ] && continue
    [ "$name" = "$STAMP" ] && continue
    rm -rf -- "${dir:?}/$name"
    log "pruned $dir/$name"
    if [ -n "$OFFSITE" ]; then
      rclone purge "$OFFSITE/${dir##*/}/$name" >/dev/null 2>&1 || warn "could not purge remote ${dir##*/}/$name"
    fi
  done <<< "$list"
  after=$(find "$dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -cE '^[0-9]{8}T[0-9]{6}Z$' || true)
  [ "$after" -le "$keep" ] || warn "retention: $after directories remain in $dir (limit $keep)"
}

prune_tier "$BACKUP_DIR/daily" "$RETENTION_DAILY"
prune_tier "$BACKUP_DIR/weekly" "$RETENTION_WEEKLY"
prune_tier "$BACKUP_DIR/monthly" "$RETENTION_MONTHLY"

log "backup $STAMP complete: $(du -sh "$CURRENT_DEST" 2>/dev/null | cut -f1) in $CURRENT_DEST"
