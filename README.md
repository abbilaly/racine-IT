# AB Tech — Next.js storefront (repo: racine-IT)

An AB Tech electronics storefront built with React / Next.js and backed by Supabase
(Postgres, Auth and Storage). It started from an Electro Pulse theme demo supplied by the
project owner; all customer-facing copy is now branded AB Tech.

## Run locally

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run build` | Production build |
| `npm run preview` | OpenNext build + local Wrangler (Workers) server with D1 bindings |

## Supabase setup

The app reads its catalogue from Supabase when it is configured. Without Supabase (local preview,
demo) it serves the seeded demo catalogue in `lib/products.ts` — nothing is required to preview the
storefront. When Supabase **is** configured but the catalogue query fails, the request fails loudly
instead of serving seed products: see “Catalogue failure policy” below.

### 1. Environment variables

Set them in `.env.local` for development (never commit them), or in **Sites → Secrets** for a
deployed environment:

```
SUPABASE_URL=https://<project-ref>.supabase.co   # Project Settings → API → Project URL
SUPABASE_SERVICE_ROLE_KEY=...                    # Project Settings → API → service_role key
SUPABASE_ANON_KEY=...                            # Project Settings → API → anon public key
```

`SUPABASE_SERVICE_ROLE_KEY` is read only by server code (`lib/supabase/server.ts`). It must never
appear in a component marked `"use client"` or in any file shipped to the browser.

#### Customer registration (required before announcing accounts)

```
CUSTOMER_ALLOW_REGISTRATION=1
```

- **Set** (`1`): `POST /api/auth/signup` creates a real Supabase `auth.user` and sends the
  verification email. This is required for customers to actually own accounts.
- **Unset, `next dev`** (`NODE_ENV !== "production"`): sign-up validates the form and shows the
  verification screen, but creates nothing (dry run). Safe for local work.
- **Unset, any deployment build**: sign-up is **refused** with an explicit “account creation is not
  open yet” message. It never pretends an account was created. Note that a hosted preview is also a
  **production build** (`NODE_ENV=production`), so the dry run exists only under `next dev` — a
  preview deployment behaves exactly like production here. Set the variable in the preview
  environment if you want to exercise real sign-up there.

When registration is disabled the account page, the sign-in page and `/account/signup` say so and
show no working sign-up button (the API is the real gate; the UI just stops pretending). Without this
variable the storefront still takes **guest orders**, but no customer can register or sign in.

### 2. Database schema and seed

- `supabase/migrations/0001_racine_core.sql` — tables (categories, products, product_images,
  product_variants, inventory, orders, order_items, store_settings, admin_roles), indexes,
  constraints, row level security policies, the storage bucket and the atomic `create_order()`
  function.
- `supabase/seed.sql` — the demo catalogue, generated from `lib/products.ts` by
  `node supabase/generate-seed.mjs`.

Apply both from the Supabase SQL editor, or with the Supabase CLI (`supabase db push`).

### 3. Create the first administrator

There is no default admin account and no hardcoded password:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='a long unique passphrase' \
node scripts/bootstrap-admin.mjs
```

Then sign in at `/admin/login`.

## How checkout stays safe

- Prices, stock, titles and shipping fees are always read from Postgres. The browser never sends a
  trusted total.
- `POST /api/orders` validates the request in TypeScript and then calls the security-definer
  `create_order()` function, which re-validates every line, locks the inventory rows it touches
  (`FOR UPDATE`), re-prices the cart, writes the order + line snapshots and decrements stock in one
  transaction. Failures raise SQLSTATE `RC001` and roll everything back.
- Order items snapshot the product (`snapshot` jsonb) so historical prices and details survive
  catalogue edits.
- Orders have **no** policies for `anon`/`authenticated`: they are readable only by the service
  role and by administrators (RLS). The public order page only ever returns an order when the exact
  `RIT-XXXXXXXX` reference is supplied.
- Every `/admin` page and `/api/admin/*` route re-verifies the Supabase Auth session and the
  `admin_roles` table; hidden links are never the security boundary.
- Product images upload to the public `product-images` bucket through policies that only grant
  writes to administrators.
- **Guest orders only (MVP):** the deployed `create_order(p_items, p_customer, p_delivery,
  p_payment, p_note)` takes five parameters, so `lib/server/orders.ts` sends exactly those five and
  every order is stored with `orders.user_id = NULL`. Order ownership needs migration `0006`; until
  it is applied and verified, `ORDER_OWNERSHIP_ENABLED` stays `false` and the authenticated create
  path refuses to run rather than filing an order under an owner it cannot write.

## MVP hardening (pre-launch)

### Catalogue failure policy

`lib/server/catalog.ts` only falls back to the seeded catalogue when Supabase is **not configured**.
When Supabase is configured and the catalogue query fails (RLS, network, schema drift, outage), the
result depends on where the read happens:

- **Application shell** (`app/layout.tsx`): tolerates the failure and keeps rendering header, footer
  and cart chrome from the seed catalogue, so `/admin/*`, `/account/*` and `/order/*` stay reachable
  during an incident — the owner can still sign in and manage orders while the catalogue is down.
  The shell read is bounded (4 s), so a *stalled* query cannot delay those pages either.
- **Catalogue-backed pages** (`/`, `/shop`, `/product/*`, `/cart`, `/checkout`, `/compare`,
  `/wishlist`): read the catalogue through `requireCatalog()` (the data pages call `loadCatalog()`
  directly) and fail with the error page. Stale seed prices and stock are never presented as current
  on a page that sells.

Current production schema note: the catalogue query does **not** filter `categories.is_active`,
because that column only arrives with `0007_categories_taxonomy.sql` and PostgREST rejects a filter
on an unknown column (42703) for the whole query. `products.is_active` still filters. There is a
`TODO(0007)` in `lib/server/catalog.ts`; restore the category filter only after 0007 is applied and
verified.

### Rate limiting

`lib/server/rate-limit.ts` applies an in-process fixed-window limit to the abuse-prone endpoints:

| Route | Limit |
| --- | --- |
| `POST /api/orders` | 10 per IP / 10 min |
| `POST /api/auth/signin` | 10 per IP / 15 min |
| `POST /api/auth/signup` | 5 per IP / 1 hour |
| `POST /api/auth/recover-request` | 5 per IP / 1 hour |
| `POST /api/admin/login` | 10 per IP / 15 min |

On Cloudflare Workers each isolate has its own memory, so this is a **per-isolate backstop**, not a
global quota. Add a durable edge rule (Cloudflare Dashboard → Security → WAF → Rate limiting rules)
for `/api/orders`, `/api/auth/*` and `/api/admin/login` before or immediately after launch. The
in-app limiter needs no database, no migration and no dependency.

Address handling: limits are keyed on `cf-connecting-ip`, which Cloudflare writes from the real
connection (a visitor cannot forge it). Off Cloudflare the limiter walks `x-forwarded-for` from the
right and accepts only syntactically valid IPs, because proxies *append* to that header and the
left-hand entries are client-controlled. If no valid address is available the request is **not**
limited (a single shared “unknown” bucket could throttle the whole store) and a warning is logged
once per isolate.

### Email Center is disabled until migration 0005

`EMAIL_CENTER_ENABLED` in `lib/site-config.ts` is `false`. The sidebar hides Email Center,
Templates, Campaigns, Follow-ups and Webhooks, and those routes redirect to `/admin`, because they
read `email_events` / `followup_rules` / `followup_jobs`, which only exist after
`0005_email_center.sql`. Apply 0005, verify it, then flip the flag to re-enable the section.

### Admin login wall

`app/admin/layout.tsx` renders the sign-in form *instead of* page content when there is no verified
administrator session, so an anonymous visitor can never receive admin markup even if a page were to
miss its own `requireAdmin()` guard. Pages keep their own guards as defence in depth.

### Order lookup privacy — recommendation

`/order/[ref]` renders the full order (name, address, phone, email) to anyone who knows a reference.
References are `RIT-` plus 8 characters from a 32-symbol alphabet (~40 bits), so guessing is
impractical, and the page is now `noindex, nofollow`. It is still a capability URL: anyone who
receives it, or finds it in a shared screen or chat log, can read the order.

Recommended safe protection, in order of strength:

1. **Email-confirmed lookup (preferred):** on the lookup form require the reference **and** the email
   used for the order, and only render full details when both match (mask the address otherwise).
   This needs no schema change — the email is already stored on `orders`.
2. **Signed token links:** give the confirmation email a short-lived signed token instead of the bare
   reference, and accept the bare reference only for a status-only view.
3. **Edge rate limiting** on `/order/*` to make enumeration attempts noisy and slow (already
   recommended above).

Not done in this phase because it changes customer-facing behaviour; it is a small, isolated change
when approved.

## Backup and recovery — open blocker

The production Supabase project currently has **no backups and no PITR** (backup list empty,
`pitr_enabled: false`, backup schedule rejected by the plan). Until that is resolved, any mistake is
unrecoverable. Before applying `0005`, `0006` or `0007`, either enable a plan with backups/PITR or
take an encrypted logical dump off-site and rehearse a restore. A local rehearsal is **not** a
production backup.

The scripts and runbook for that off-site dump live in [`scripts/backup/`](scripts/backup/README.md):
`backup.sh` (a single consistent `public` + `auth` dump, verified encryption, HMAC- or gpg-signed
manifest, storage/object copy-and-check, off-site copy-and-check, 7/4/12 retention), `verify.sh`
(49 integrity checks including manifest-signature and archive-hash verification and API-role grants),
`restore-drill.sh` and `test-negative.sh` (17 assertions). All fixes from the security review have been
applied here: encryption is verified before the plaintext is shredded, retention actually prunes,
plaintext on loopback is opted in explicitly, manifests are tamper-evident, and the drill will not
delete anything it did not create. They have been rehearsed locally only — no production connection or
export has happened yet.

## Verification

```bash
# schema, RLS, atomic checkout and concurrency (spins up a local PostgreSQL 17)
cd .verify && npm install && node schema.mjs

# HTTP checks against a running server (checkout, validation, order pages)
BASE=http://127.0.0.1:3000 node .verify/orders.mjs

# the same checks also pass against the production build on `npm run preview`
BASE=http://127.0.0.1:8787 node .verify/orders.mjs

# layout and image checks (needs Playwright + Chromium)
cd .verify && npm install && npx playwright install chromium
BASE=http://127.0.0.1:3000 node .verify/responsive.mjs
BASE=http://127.0.0.1:3000 node .verify/images.mjs
```

## Assets

All imagery (product shots, banners, category tiles, brand logos, the theme logo and the payment-method strip) is stored in this repository under `public/images/`, so the site has no dependency on the reference host at runtime. The files come from the reference demo package supplied by the project owner (`electro.zip`); replace them with the final AB Tech branding and photography before launch.

Reference theme demo (historical): https://wpglozin.com/electro/