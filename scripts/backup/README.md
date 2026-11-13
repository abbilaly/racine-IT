# Backup and restore — AB Tech

The production Supabase project is on the **Free plan**: no managed backups, no PITR,
backup scheduling rejected. These scripts are the only safety net until the project
moves to a paid plan.

Status: **implemented, security-reviewed and rehearsed locally against synthetic data
only.** Nothing here has run against production, exported production data, or created
cloud resources.

## Contents

| File | Purpose |
| --- | --- |
| `backup.sh` | Nightly consistent dump of `public` + `auth`, verified encryption, signed manifest, off-site copy, 7/4/12 retention. Plan-only by default. |
| `verify.sh` | 49 integrity checks (counts, referential, business, grants), manifest signature and archive-hash verification. |
| `restore-drill.sh` | Local rehearsal: throwaway cluster, migrations, synthetic data, signed backup, restore, verify, two negative controls. |
| `test-negative.sh` | 17 assertions that unsafe paths are refused and tampering is detected. |
| `lib.sh` | Shared helpers (logging, PostgreSQL binaries, guarded cluster lifecycle). |
| `synthetic-fixture.sql` | Synthetic rows for the rehearsal — never real data. |
| `drill-roles.sql`, `drill-platform.sql`, `drill-restore.sql` | Local-only stubs for Supabase-managed roles/auth/storage. |
| `post-restore.sql` | Re-applies the API-role grants the application needs. |
| `backup.env.example` | Variable names the scripts read. |

## Architecture

```
nightly cron
  └─ backup.sh --confirm-production
       ├─ pg_dump -n public -n auth  (single consistent snapshot)
       │    ├─ pg_restore --list        → must be a readable archive
       │    ├─ encrypt (age | gpg)      → archive size + magic/structure verified
       │    └─ plaintext shredded       → only after the ciphertext validates
       ├─ rclone copy + rclone check    (optional storage snapshot, metadata kept)
       ├─ manifest.txt                  (hashes, sizes, row counts, git commit)
       ├─ manifest signature            (gpg .asc, or HMAC .sig)
       ├─ upload + rclone check         (only signed/encrypted files leave the host)
       └─ retention: 7 daily · 4 weekly · 12 monthly
```

Layout: `daily/<stamp>/`, `weekly/<stamp>/`, `monthly/<stamp>/`; the current run's
directory is never pruned and only names matching `YYYYMMDDTHHMMSSZ` are ever deleted.

## Prerequisites

- **PostgreSQL 16 client binaries** (`psql`, `pg_dump`, `pg_restore`); set `BACKUP_PG_BIN`
  when they are not on `PATH`.
- **age** (preferred) or **gpg** for encryption; **openssl** if you use the HMAC fallback;
  **rclone** for storage and off-site.
- **Connection string** from Supabase → Project Settings → Database. Session pooler or
  direct connection (port 5432), never the transaction pooler on 6543.
- ~`BACKUP_MIN_FREE_MB` (default 512 MB) free where backups are staged.
- `scripts/backup/backup.env` (chmod 600, gitignored) filled in from `backup.env.example`.

Cron:

```
15 3 * * *  set -a; . /srv/abtech/backup.env; set +a; /srv/abtech/repo/scripts/backup/backup.sh --confirm-production >> /var/log/abtech-backup.log 2>&1
```

Alert on **non-zero exit** and on the newest `manifest.txt` being older than 26 hours.

## Safety rules enforced by the scripts

- **Plan by default.** Without `--confirm-production` (or `--local-drill`) nothing is
  written, uploaded or deleted.
- **Remote host needs explicit confirmation.** `--confirm-production` and `--local-drill`
  are mutually exclusive.
- **No plaintext for a real database.** Unencrypted dumps require *both* `--local-drill`
  and `BACKUP_ALLOW_PLAINTEXT=1`; a loopback port-forward to production is therefore
  refused unless you deliberately opt in.
- **TLS.** A remote URL without `sslmode` gets `sslmode=require` appended.
- **Verified encryption.** The plaintext must be a readable archive, the ciphertext must
  be non-trivially sized and structurally valid (age magic / OpenPGP packet), and only
  then is the plaintext shredded. A failing encryptor aborts the run with nothing
  published.
- **Credentials out of argv.** The password is moved into `PGPASSWORD` so it does not
  appear in `ps`.
- **Single-instance.** A lock directory with owner PID; locks older than
  `BACKUP_LOCK_STALE_MINUTES` (180) are reclaimed, younger ones block the run.
- **Disk space.** The run refuses to start below `BACKUP_MIN_FREE_MB`.
- **Upload verification.** `rclone check` runs after every copy; a mismatch fails the run
  before retention prunes anything.

## First production run

```
scripts/backup/backup.sh --confirm-production --dry-run   # prints the plan; touches nothing
scripts/backup/backup.sh --confirm-production             # execute
ls -R backups/daily/<stamp>/
cat backups/daily/<stamp>/manifest.txt
```

Exit code 0 means: dump validated, ciphertext verified, manifest signed, upload checked,
retention applied.

## Encryption and key management

- **age** recipient (`age1…`) on the server; the identity file stays offline in two
  separate locations. gpg works the same way, with the recipient key imported and trusted
  — the scripts no longer bypass trust checks.
- The recipient is validated before any dump, so a typo fails immediately instead of
  producing an unusable archive.
- **Lost key = lost backups.** Rotation: add the new recipient, keep the old identity until
  every archive encrypted with it has expired (the manifest records the encryption used).
- Plaintext exists only in a private work directory (`umask 077`) between dump and
  encryption, and is shredded on success *and* on failure.

## Manifest authenticity

The manifest is the thing `verify.sh` trusts, so it is signed:

- `BACKUP_MANIFEST_SIGN_KEY` (gpg key id) → `manifest.txt.asc` detached signature. This is
  the better option: verification needs only the public key.
- Otherwise `BACKUP_MANIFEST_HMAC_KEY` → `manifest.txt.sig` (HMAC-SHA256, openssl). Keep the
  key off the backup media: anyone who can write the backup directory *and* read the key
  can re-sign a tampered manifest.
- With neither set the run still succeeds but warns loudly that the manifest is not
  tamper-evident; `verify.sh --require-signed` fails it.

`verify.sh` checks, in order: signature → archive sha256/size → row counts → invariants.
Editing a count in a signed manifest makes verification fail, which the drill and the
negative suite both assert.

## What is and is not backed up

| Item | In backup | Notes |
| --- | --- | --- |
| `public` data, functions, triggers, policies | yes | single consistent dump |
| `auth.users`, `auth.identities` | yes | email, hash, metadata |
| `auth.sessions`, `refresh_tokens`, `flow_state`, MFA claims, audit log | excluded | disposable and large |
| Storage objects | via `BACKUP_STORAGE_REMOTE` | `rclone copy --metadata --checksum` then `rclone check` |
| Bucket definitions/policies | via migrations | `0001` inserts the bucket row |
| Roles, extensions, platform schemas | **no** | Supabase-managed |
| Project settings (providers, redirect URLs, SMTP, keys) | **no** | keep written down |
| PITR / WAL | **no** | paid add-on |

**Do not blindly restore Supabase-managed objects.** `auth`, `storage`, the
`anon`/`authenticated`/`service_role` roles and extensions belong to the platform. The
drill restores only what is portable and stubs the rest; production should do the same.

## Restore procedure (production)

**A. A few bad rows** — restore to a scratch database and copy back:

```
createdb abtech_scratch
pg_restore --no-owner --no-privileges -d abtech_scratch <archive>
psql abtech_scratch -c "\copy (select * from public.products) to 'products.csv' csv header"
psql "$SUPABASE_DB_URL" -c "\copy public.products from 'products.csv' csv header"
```

**B. Whole database lost** — new Supabase project:

1. Apply `supabase/migrations/0001…0007` in order.
2. Restore the data: `pg_restore --data-only --no-owner --no-privileges -d "$URL" <archive>`.
   The archive also contains `CREATE SCHEMA public/auth`; into a database that already has
   them, either use `--data-only` or filter those two TOC lines (the drill shows how).
3. Recreate auth users. The dump carries `auth.users` **schema and data**, which cannot be
   `pg_restore`d over a live project's platform-owned `auth` schema — export the users from
   the archive (`pg_restore --data-only -t users -t identities`) or import them through the
   dashboard/admin API. Password hashes are only portable within the same project secrets;
   users of a *different* project need password resets. MFA enrolments and sessions are
   never restorable.
4. Run `post-restore.sql` so `anon`/`authenticated`/`service_role` keep their grants.
5. Re-upload Storage objects (`rclone copy` with `--metadata`).
6. Point the deployment at the new project and redeploy.
7. `verify.sh --db-url … --manifest … --require-signed --check-grants`.

**C. Deleted orders** — restore to scratch and re-insert the missing rows; never point the
app at a day-old database.

## Local rehearsal

```
BACKUP_PG_BIN=/usr/lib/postgresql/16/bin scripts/backup/restore-drill.sh
BACKUP_PG_BIN=/usr/lib/postgresql/16/bin scripts/backup/test-negative.sh
```

The drill: throwaway cluster on `127.0.0.1:55432` → migrations 0001…0007 → synthetic data →
signed backup → restore into a fresh database → `post-restore.sql` → `verify.sh` (**49
checks**) → delete a row (must fail) → edit the manifest (must fail its HMAC).

The negative suite asserts 17 unsafe outcomes: remote without confirmation, conflicting
flags, plaintext without opt-in, low disk, a partial-writing encryptor publishing nothing,
an unmarked `DRILL_ROOT` being refused, retention keeping exactly one backup, tampered
manifest and corrupted archive both detected, stale lock reclaimed and a live lock
respected.

Both scripts refuse a `DRILL_ROOT` that is not under `/tmp`/`$TMPDIR`, is inside the repo,
or lacks their marker file — they will not delete a directory they did not create.

## Integrity checks

`verify.sh` runs: signature, archive hash/size, per-table counts, core-table presence,
`store_settings` = 1 row, non-empty `auth.users`, referential checks (orphan items, images,
inventory, categories, orders/admin roles → users), business checks (item_count, totals,
line totals, negative stock, duplicate/malformed refs, negative prices), optional grant
checks, manifest count comparison, optional storage count/bytes. 49 checks in the drill.

## Retention

| Tier | Copies | How |
| --- | --- | --- |
| daily | 7 | every run |
| weekly | 4 | Sunday run hard-links into `weekly/` |
| monthly | 12 | run on the 1st hard-links into `monthly/` |

Pruning keeps the newest N per tier, never deletes the current run, only touches
stamp-named directories, and logs a warning if the post-prune count exceeds the limit.
Remote pruning mirrors the same names.

## Risks and limitations

- **RPO up to 24 hours** without PITR; orders are money — consider twice-daily runs.
- **Storage and database are not atomic**: the object copy happens after the dump and is
  checked against the source, but a write between the two steps can still diverge. The
  counts will flag it.
- **HMAC key placement** decides how strong tamper-evidence is. Prefer gpg signatures with
  the private key on the host and the public key everywhere else.
- **Platform state** (auth providers, SMTP, redirect URLs, keys) is not covered.
- **Password hashes** survive only within the same project secrets.
- **The drill uses stubs**, so it proves the scripts and the checks, not Supabase's exact
  auth/storage internals. The first real restore should go into a scratch project.
- **Free plan**: if the project is paused or deleted, Supabase-held data goes with it;
  off-site copies are the only guard.
- **Monitoring matters**: a cron job that fails silently is worse than none. Alert on
  non-zero exit and on a stale manifest.
