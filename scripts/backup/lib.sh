#!/usr/bin/env bash
# Shared helpers for the AB Tech backup scripts. Sourced, not executed.
# shellcheck shell=bash

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
warn() { log "WARN: $*"; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

# Run a PostgreSQL binary from BACKUP_PG_BIN when set, otherwise from PATH.
pg() {
  local bin=$1
  shift
  if [ -n "${BACKUP_PG_BIN:-}" ]; then
    "$BACKUP_PG_BIN/$bin" "$@"
  else
    "$bin" "$@"
  fi
}

require_pg_bin() {
  local c
  for c in psql pg_dump pg_restore; do
    if [ -n "${BACKUP_PG_BIN:-}" ]; then
      [ -x "$BACKUP_PG_BIN/$c" ] || die "missing $BACKUP_PG_BIN/$c"
    else
      need "$c"
    fi
  done
}

# Rehearsal directories contain data we create and delete. Refuse anything that
# is not clearly ours: must live under /tmp or $TMPDIR, must not be /, $HOME or
# the repository, and an existing directory must carry the marker file.
guard_drill_root() {
  local root=${1:?} marker=${2:-.racine-drill} parent tmp
  case "$root" in
    ""|"/"|"$HOME"|"$HOME/"|"$HOME/.local"|"$HOME/."*)
      die "refusing DRILL_ROOT='$root'" ;;
  esac
  case "$root" in
    "$REPO_ROOT"|"$REPO_ROOT/"*)
      die "refusing DRILL_ROOT inside the repository: '$root'" ;;
  esac
  tmp=${TMPDIR:-/tmp}
  tmp=${tmp%/}
  parent=$(cd -- "$(dirname -- "$root")" 2>/dev/null && pwd -P) || die "cannot resolve parent of DRILL_ROOT='$root'"
  case "$parent" in
    "$tmp"|"$tmp/"*) : ;;
    *) die "DRILL_ROOT must live under $tmp (got '$root')" ;;
  esac
  if [ -e "$root" ]; then
    [ -d "$root" ] || die "DRILL_ROOT exists and is not a directory: '$root'"
    [ -f "$root/$marker" ] || die "refusing to delete '$root': no $marker marker (not created by these scripts)"
  fi
}

# Create the marker before anything else, so a later run recognises its own dir.
mark_drill_root() {
  local root=$1 marker=${2:-.racine-drill}
  mkdir -p "$root"
  printf 'created by scripts/backup on %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$root/$marker"
  chmod 600 "$root/$marker"
}

cluster_start() { # $1 root, $2 port
  local root=$1 port=$2
  mkdir -p "$root/sock"
  pg initdb -D "$root/pgdata" -U postgres --auth=trust --encoding=UTF8 --locale=C >"$root/initdb.log" 2>&1 \
    || die "initdb failed (see $root/initdb.log)"
  pg pg_ctl -D "$root/pgdata" -l "$root/postgres.log" \
    -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=$root/sock" start >/dev/null \
    || die "postgres failed to start (see $root/postgres.log)"
  local i
  for i in $(seq 1 40); do
    pg pg_isready -h 127.0.0.1 -p "$port" -q && return 0
    sleep 0.5
  done
  cat "$root/postgres.log" >&2 || true
  die "postgres did not become ready on 127.0.0.1:$port"
}

cluster_stop() { # $1 root
  [ -d "$1/pgdata" ] || return 0
  pg pg_ctl -D "$1/pgdata" -m immediate stop >/dev/null 2>&1 || true
}
