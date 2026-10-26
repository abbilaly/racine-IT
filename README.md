# racine-IT — Electro Pulse React storefront

A React / Next.js storefront recreation based on the public Glozin Electro Pulse demo, backed by
Supabase (Postgres, Auth and Storage).

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

The app reads its catalogue from Supabase when it is configured, and falls back to the seeded demo
catalogue in `lib/products.ts` when it is not. Nothing is required to preview the storefront.

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

All imagery (product shots, banners, category tiles, brand logos, the theme logo and the payment-method strip) is stored in this repository under `public/images/`, so the site has no dependency on the reference host at runtime. The files come from the reference demo package supplied by the project owner (`electro.zip`); replace them with the final Racine IT branding and photography before launch.

Reference demo: https://wpglozin.com/electro/