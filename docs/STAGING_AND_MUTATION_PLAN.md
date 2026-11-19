# Staging and mutation-test plan

**Status: plan only. No staging resources were created, no secrets changed, and no
credentials were pointed at a second environment.** Creating a Supabase project or
branch is a billable, account-level action and needs the owner's approval.

## 1. Current state

| Item | Finding |
| --- | --- |
| Supabase projects on the connected account | **One**: `racine-IT` (`lqyvcrseuojfpeodwawn`), ACTIVE_HEALTHY, eu-west-1 — the production database |
| Separate staging database | **None** |
| Database branches | See the audit report; none are used by this project |
| Cloudflare environments | `wrangler.jsonc` defines a single Worker (`racine-it`); no `[env.staging]` block |
| Local Postgres / Docker | Docker socket exists but the account cannot access it; `sudo` is blocked. Migration SQL is validated in-process with PGlite instead (see `scripts/verify-migration-0010.mjs`) |
| Admin mutation tests | **Not run**: no isolated database exists, and running them against production is forbidden |

## 2. Recommended staging topology

1. **New Supabase project** `racine-it-staging` in the same region.
   - Isolated database, isolated Storage bucket, isolated Auth users.
   - Never reuse the production `SUPABASE_URL`, keys or JWT secret.
2. **Apply the migrations in order** `0001` → `0010` with `supabase db push --project-ref <staging-ref>`.
   - Apply `0010` to staging first; it is the release gate for production.
3. **Seed** staging with anonymised catalogue data: a handful of products, two banners,
   one test customer, one test order. Never copy customer PII from production.
4. **Create one staging admin user** in Supabase Auth plus an `admin_roles` row.
5. **Worker environment** (optional, for end-to-end): add a `staging` environment in
   `wrangler.jsonc` with its own vars and its own D1 database binding.
6. **Local env file** for the staging app: `.env.staging.local` (git-ignored) holding the
   staging URL and keys, loaded with `dotenv -e .env.staging.local -- next dev`.
   `.env.local` must keep pointing at production so nothing accidentally cross-writes.

## 3. Guard rails for the mutation suite

Before any write, the test harness must assert:

- `SUPABASE_URL` is **not** the production host (`lqyvcrseuojfpeodwawn.supabase.co`).
- A `staging_marker` row exists in `store_settings` (for example `store_name = 'AB Tech STAGING'`).
- Every created record is tagged with a unique prefix (`ZZTEST-<runid>`) so cleanup is exact.
- The suite exits without writing if any guard fails.

## 4. Mutation checklist (to run once staging exists)

| # | Journey | Steps | Assertions | Cleanup |
| --- | --- | --- | --- | --- |
| 1 | Create product | POST a product with title `ZZTEST-<runid>`, price, category, brand, SKU, specs | Row exists with the exact values; slug generated; appears in `/admin/products` search | Delete row (images first, then product) |
| 2 | Edit product | Change title, price, compare-at price, stock, status | Values persisted; storefront price updates; hidden product disappears from `/shop` | Restore or delete |
| 3 | Delete product | Delete the test product | Row gone; dependent images and inventory removed/no orphans | — |
| 4 | Upload image | Upload a small WebP through `/api/admin/products/[id]/images` | Object stored in Storage; `product_images` row has kind `primary`; URL renders | Delete object + row |
| 5 | Replace image | Upload a second file as `primary` | Previous primary is replaced, no duplicate primary (the slot-safe update from `adabaeb`) | Delete object + row |
| 6 | Remove image | Delete the image | Row and object removed; product falls back to the other image | — |
| 7 | Create category | POST slug `zztest-<runid>`, label, parent | Row exists, position set, appears in admin and in `/categories` | Delete |
| 8 | Edit category | Change label/description/icon/visibility | Persisted; hidden category vanishes from storefront and its URL redirects | Restore |
| 9 | Delete category | Delete the empty test category | Row gone; deleting a category with products is refused with a clear message | — |
| 10 | Banner update | Create a banner, upload desktop + mobile images, set focal points, reorder | Values persist in `homepage_banners`; homepage shows the banner; mobile crop uses `focus_mobile` | Delete banner + images |
| 11 | Store settings | Change store name, currency, shipping fees, checkout toggle | Values persist; storefront header and checkout totals change accordingly | Restore original values exactly |
| 12 | Customer notes | Add two notes on a test customer, edit one | Notes persist under `subject_type = 'customers'`; timeline orders them newest first | Delete notes |
| 13 | Order status | Move a test order received → processing → shipped → delivered → cancelled | Status persisted; timeline shows each transition; cancelled orders excluded from best sellers and revenue | Delete test order |
| 14 | Inventory | Adjust stock +5 then −5 | `inventory.on_hand` matches; `stock_adjustments` rows recorded; negative stock refused | Delete adjustments, restore on_hand |

## 5. Definition of done

- Every row above passes twice in a row (idempotent cleanup).
- Staging database is byte-compared against production **schema only** (no data) before
  promoting: `pg_dump --schema-only` on both, diff must be empty after `0010` is applied
  to production.
- `node scripts/audit-admin.mjs` passes with `AUDIT_BASE_URL` pointed at staging.
- Only then apply `0010` and deploy the Worker to production.
