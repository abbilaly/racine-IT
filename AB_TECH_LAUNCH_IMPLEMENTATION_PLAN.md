# AB Tech — Launch Implementation Plan

**Status:** planning only. Nothing below has been executed. No migration applied, no database write, no order created, no secret or production configuration changed, no commit, push or deploy.
**Date:** 2026-11-13
**Branch / HEAD:** `freebuff/racine-it-admin-supabase` @ `089eb243d7b0a52fdeef7c9ab83bc096fbb0e59a`
**Source of truth:** `PRODUCTION_READINESS_DECISION_PLAN.md` + owner decisions 1–8 (mapped in §0).

---

## 0. Decision → workstream traceability

| Owner decision | Workstream | Where |
|---|---|---|
| 1. 0007 conditionally approved (backup, history, clone, rollback, final approval) | **W1** | §2 |
| 2. Retired rows retained as inactive | **W1** | §2.4 |
| 3. Empty categories hidden from public nav, kept in Admin | **W1** | §2.7 |
| 4. Separate `create_order_idempotent`; replay on same payload, **409** on different payload | **W2** | §3 |
| 5. Neutral AB Tech email branding, no IT-services claims | **W3** | §4 |
| 6. Inspect real 0002–0006 migration history first | **Gate G1** | §2.2, §6 |
| 7. "Price on request" only for real sellable products with supplier-confirmed availability | **W4** | §5 |
| 8. No unverified demo price/stock presented as genuine | **W4** | §5 |

**Blocking discovery for decision 6:** this workspace has **no Supabase CLI, no `psql`, no `SUPABASE_ACCESS_TOKEN` and no `SUPABASE_DB_URL`**, so migration history cannot be read from here. G1 is an owner-run SQL step (§2.2) and every dependent workstream waits for it.

---

# W1 — Migration 0007 + legacy URL aliases

## 2.1 Database objects affected

| Object | Change | Reversible? |
|---|---|---|
| `public.categories` | `ADD COLUMN is_active boolean NOT NULL DEFAULT true` | Yes (rollback drops it) |
| `public.categories` row `d68104ff…` (`phones`) | `slug → smartphones`, `label → Smartphones & Tablets`, `position → 6` | Yes |
| `public.categories` row `84d6206c…` (`laptops`) | `slug → computers`, `label → Computers & Laptops`, `position → 1` | Yes |
| `public.categories` row `c69827ba…` (`wearables`) | `label → Wearables & Smartwatches`, `position → 7` | Yes |
| `public.categories` rows `fd414ab7…` (`tablets`), `5857c9ab…` (`audio`) | `is_active = false`, positions 15 / 16, **rows retained** (decision 2) | Yes |
| `public.categories` | 11 new rows: `desktops`, `servers`, `networking`, `components`, `gaming`, `printers`, `monitors`, `multimedia`, `peripherals`, `software`, `power` | Yes (deleted by rollback) |
| `public.products.category_id` | 5 rows moved: 2 iPads `tablets → smartphones`, 3 audio `audio → multimedia` | Yes (rollback moves back) |
| `public._migration_0007_state` | New marker table (mode, pre-state snapshot, timestamp); RLS on, no policies, revoked from API roles | Yes (dropped by rollback) |

**Untouched:** `orders`, `order_items`, `inventory`, `product_images`, `product_variants`, `store_settings`, all customer/admin data.

**Files the migration pairs with (deploy in the same release):**

| File | Change |
|---|---|
| `lib/server/catalog.ts` | Restore `.eq("is_active", true)` on the categories query (the existing `TODO(0007)` at lines 66–73) |
| `lib/server/catalog.ts` | Derive `visibleCategories` (categories with ≥1 product) for public navigation |
| `app/shop/page.tsx` | Legacy-slug redirect before rendering (`phones → smartphones`, `laptops → computers`, `tablets → smartphones`, `audio → multimedia`) |
| `lib/shop-params.ts` | Optional: `normaliseLegacyCategory(slug)` helper used by the page |
| `components/MobileMenu.tsx`, `components/CategoryPanel.tsx`, `components/HomeView.tsx`, `components/ShopControls.tsx`, `components/Footer.tsx` | Consume `visibleCategories` instead of all categories for public navigation |
| `lib/products.ts` | No taxonomy change needed — `CATEGORIES` and `CATEGORY_SUBKEYS` already match 0007, and `categoryShopHref()` already resolves subkeys to parent categories |
| Admin | **No change** — `lib/server/admin-data.ts` already selects `is_active`; after 0007 `/admin/categories` starts working |

## 2.2 Gate G1 — migration-history verification (owner-run, blocks everything)

Run in the Supabase SQL editor (production, read-only):

```sql
select version, name, inserted_at
from supabase_migrations.schema_migrations
order by version;

select
  to_regclass('public.brands')                         is not null as m0002_brands,
  exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='suppliers')  as m0003_suppliers,
  exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='products'
            and column_name='brand_id')                as m0004_brand_id,
  to_regclass('public.email_events')                   is not null as m0005_email_events,
  to_regclass('public.followup_rules')                 is not null as m0005_followup_rules,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='create_order'
            and pg_get_function_identity_arguments(p.oid) like '%uuid%') as m0006_overload,
  exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='categories'
            and column_name='is_active')               as m0007_is_active;
```

**Interpretation**
- `m0007_is_active = true` → STOP. 0007 is already applied; the taxonomy work is done and only the code-side work (visibility filter, aliases, nav) remains.
- `m0004_brand_id = true` → brand work (§5.4) may proceed after data entry.
- `m0006_overload = true` → 0006 is applied, but `ORDER_OWNERSHIP_ENABLED` still stays `false` until verified end-to-end.
- Any boolean mismatch must be investigated before writing dependent code; record the output in the launch log.

## 2.3 Pre-flight (read-only, production)

1. `select id, slug, label, position from public.categories order by position;` → exactly the five rows in §2.1.
2. `select c.slug, count(*) from products p join categories c on c.id = p.category_id group by 1 order by 1;` → `phones 3, laptops 2, tablets 2, audio 3, wearables 2`.
3. `select count(*) from products where category_id is null;` → `0`.
4. `select count(*) from products;` → `12`.
5. Confirm **no catalogue writes** are possible during the window: no admin session creating/editing products, no CSV import running.
6. Record the pre-state as a backup (§7).

## 2.4 Clone rehearsal (Gate G2)

On a restored clone, not production:

1. Apply `supabase/migrations/0007_categories_taxonomy.sql`.
2. Run the post-verification set (§2.6).
3. Apply `supabase/rollback/0007_categories_taxonomy_rollback.sql`.
4. Verify the clone matches the pre-state exactly: 5 rows, original slugs/labels/positions (`tablets` 2, `audio` 3), `is_active` dropped, `_migration_0007_state` dropped, products back on `tablets`/`audio`, 12 products.
5. Re-apply 0007 and verify again (proves repeatability from a restored state).

**Abort criteria for the rehearsal:** any guard exception, any product with a moved/unmoved category other than the 5 expected, any category count other than 14 active / 2 inactive, rollback leaving any residue.

## 2.5 Production execution (Gate G3 — final approval)

One transaction, in this order:

1. Announce the catalogue write freeze.
2. Apply `0007_categories_taxonomy.sql` (the script is self-guarded: preconditions, mode resolution, product guards, post-checks; any failure rolls the whole script back including the marker).
3. Run §2.6 immediately. If any check fails → **stop** and run the rollback (§2.8), not a patch.
4. Deploy the paired code release (§2.1 files) — same window, because until it lands the storefront lists the two inactive categories and legacy URLs still resolve to the old slugs.
5. Clear the write freeze.
6. Verify the live storefront: 5 category links in nav/footer, all returning products; `/shop?category=servers` renders an empty state (category exists, has no products), not an error.

## 2.6 Post-apply verification SQL

```sql
select is_active, count(*) from public.categories group by 1 order by 1;   -- true 14 | false 2
select count(*) from public.products;                                       -- 12
select count(*) from public.products where category_id is null;             -- 0
select c.slug, count(*) from public.products p
  join public.categories c on c.id = p.category_id
 where c.is_active group by 1 order by 1;   -- computers 2, multimedia 3, smartphones 5, wearables 2
select slug, label, position from public.categories where is_active order by position;  -- the 14 approved rows
select count(*) from public.categories where not is_active
   and slug not in ('tablets','audio');                                     -- 0
select count(*) from public.categories c
  where not c.is_active and exists (select 1 from public.products p where p.category_id = c.id); -- 0
```

## 2.7 URL alias mapping and timing

After 0007 the slugs `phones`, `laptops`, `tablets`, `audio` no longer exist as **active** categories, so any saved link would render an empty result set. Redirect them **301** to the canonical URL, preserving all other query parameters.

| Legacy slug | Canonical slug | Rationale |
|---|---|---|
| `phones` | `smartphones` | same row, relabelled |
| `laptops` | `computers` | same row, relabelled |
| `tablets` | `smartphones` | products moved to smartphones |
| `audio` | `multimedia` | products moved to multimedia |

**Timing is strict:** the alias map ships **in the same release as 0007**, never before. Applied early, `phones → smartphones` would redirect a working 3-product page to an empty one (pre-migration `smartphones` holds zero products).

Implementation shape (in `app/shop/page.tsx`, before `loadCatalog()`):

```ts
const LEGACY_CATEGORY_SLUG: Record<string, string> = {
  phones: "smartphones", laptops: "computers", tablets: "smartphones", audio: "multimedia"
};
// if LEGACY_CATEGORY_SLUG[state.category] exists → redirect(`/shop?${paramsWith(canonical)}`, 301)
```

Do **not** map at the `readShopState` level: the alias must be a real redirect so addresses in emails, ads and bookmarks converge on one URL.

## 2.8 Rollback strategy

- Script: `supabase/rollback/0007_categories_taxonomy_rollback.sql` (already written and mode-aware; reads `_migration_0007_state`, aborts if the marker is missing, restores labels/positions/active flags, moves products back, deletes the 11 new rows, drops `is_active` and the marker).
- Run manually with `psql` by the owner/DBA; it is deliberately outside `supabase/migrations` so no CLI can apply it.
- **Caveat:** rollback drops `categories.is_active`, which `lib/server/admin-data.ts` and the post-0007 `catalog.ts` filter both require. Therefore rollback = **schema rollback + code rollback together**. If code cannot be rolled back immediately, stop after the data restore and leave `is_active` in place (comment it out of the rollback script at that point — an owner decision at the time).
- Rollback triggers: any §2.6 check fails; any product on an inactive category; nav shows an empty category; admin category screens still error after apply.

---

# W2 — Additive checkout idempotency

## 3.1 Database objects (new migration `0008_order_idempotency.sql`)

| Object | Change |
|---|---|
| `public.orders` | `ADD COLUMN idempotency_key text` (nullable) |
| `public.orders` | `ADD COLUMN idempotency_fingerprint text` (nullable) — SHA-256/MD5 of the normalised request |
| `public.orders` | `CREATE UNIQUE INDEX orders_idempotency_key_uidx ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL` |
| `public.create_order_idempotent(jsonb, jsonb, text, text, text, text, text, uuid)` | **New function**, distinct name, `SECURITY DEFINER`, `search_path = public, pg_temp`, execute granted to `service_role` only |
| Existing `create_order` (5-arg) and `create_order(…, uuid)` (6-arg, if 0006 applied) | **Untouched** — no `CREATE OR REPLACE`, no signature change, no overload ambiguity |

**Why a separate name:** PostgREST resolves overloads by named arguments. A seventh `create_order` overload would risk `PGRST203` on any call that omits optional args. A distinct function name makes the new path explicit and leaves the deployed Worker's calls byte-identical.

### SQL design (proposed, not applied)

```sql
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists idempotency_fingerprint text;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key) where idempotency_key is not null;

create or replace function public.create_order_idempotent(
  p_items           jsonb,
  p_customer        jsonb,
  p_delivery        text,
  p_payment         text,
  p_note            text default null,
  p_idempotency_key text default null,
  p_user_id         uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fingerprint text;
  v_existing    record;
begin
  -- 1. No key: behave exactly like the current 5-arg function.
  -- 2. Key present: serialise same-key callers for the life of this transaction.
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('order:' || p_idempotency_key, 0));
  end if;

  -- 3. Normalised fingerprint of the semantic payload (order of items ignored).
  v_fingerprint := md5(
    coalesce((select jsonb_agg(elem order by elem->>'slug')
                from jsonb_array_elements(p_items) elem)::text, '[]')
    || '|' || p_delivery || '|' || p_payment
    || '|' || coalesce(p_note, '')
    || '|' || coalesce(p_customer->>'email', '')
    || '|' || coalesce(p_customer->>'firstName', '') || '|' || coalesce(p_customer->>'lastName', '')
    || '|' || coalesce(p_customer->>'phone', '')
    || '|' || coalesce(p_customer->>'address', '') || '|' || coalesce(p_customer->>'city', '')
    || '|' || coalesce(p_customer->>'postal', '')  || '|' || coalesce(p_customer->>'country', '')
  );

  -- 4. Replay or conflict.
  if p_idempotency_key is not null then
    select * into v_existing from public.orders o
      where o.idempotency_key = p_idempotency_key;
    if found then
      if v_existing.idempotency_fingerprint is distinct from v_fingerprint then
        raise exception 'This checkout attempt was already completed with different details.'
          using errcode = 'RC002';
      end if;
      return jsonb_build_object(
        'ok', true, 'replayed', true,
        'id', v_existing.id, 'ref', v_existing.ref, 'status', v_existing.status,
        'item_count', v_existing.item_count, 'subtotal', v_existing.subtotal,
        'shipping', v_existing.shipping, 'total', v_existing.total,
        'created_at', v_existing.created_at
      );
    end if;
  end if;

  -- 5. First execution: the existing create_order body verbatim, with
  --      idempotency_key / idempotency_fingerprint added to the orders insert
  --      and 'replayed', false in the returned jsonb.
  --      p_user_id is honoured only when non-null; otherwise user_id stays NULL.
  ...
end;
$$;

revoke all on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) from public;
revoke all on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) from anon;
revoke all on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) from authenticated;
grant execute on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) to service_role;
```

`RC002` is a new SQLSTATE for a **409**. `RC001` keeps its current 400/409 mapping.

## 3.2 Application files

| File | Change |
|---|---|
| `lib/orders.ts` | `CreateOrderRequest` gains `idempotencyKey?: string`; `CreateOrderResponse` gains `replayed?: boolean` |
| `lib/server/orders.ts` | `parseOrderRequest` validates the key (UUID v4, ≤ 64 chars, optional); `createOrderSupabase` calls `create_order_idempotent` when a key is present, `create_order` otherwise; map `RC002` → `OrderError(msg, 409)`; map `replayed: true` into the response |
| `app/api/orders/route.ts` | 201 for a new order, **200 for a replay**, **409 for a key/payload mismatch** (passes `error.status` through the existing `OrderError` branch) |
| `components/CheckoutView.tsx` | Generate a stable key per checkout attempt; persist it with the payload fingerprint; clear it on success; render the replay and 409 messages |
| `lib/server/orders-customer.ts` | No change required; it calls `createOrderSupabase` and inherits the behaviour once a key is passed (ownership still gated by `ORDER_OWNERSHIP_ENABLED`) |
| `app/api/admin/orders/**`, `lib/server/admin-auth.ts` | **Unchanged** — admin auth and admin order management are not in this blast radius |

**Key lifecycle (client):**

1. On a non-empty, hydrated cart, compute `fingerprint = JSON.stringify({items: sortedBySlug, delivery, payment, email})`.
2. Read `sessionStorage["ab-checkout-attempt"]` → `{key, fingerprint}`.
3. If missing or `fingerprint` differs → `key = crypto.randomUUID()`, store both.
4. Send `idempotencyKey: key` on every submit, including retries after a timeout or reload.
5. On `200`/`201` → clear the stored attempt, navigate to `/order/{ref}`.
6. On `409` → keep the cart, show "this checkout was already completed with different details — check your orders before starting a new one", and issue a **fresh** key only if the customer explicitly starts a new attempt.

## 3.3 Failure-mode behaviour after the change

| Scenario | Result |
|---|---|
| Worker dies after commit; customer retries | Same key → replay, original `ref`, **no second order, no second stock decrement** |
| Double-tap submit | Second request waits on the advisory lock, then replays |
| Two tabs, same cart, same key | One order; the second tab gets the replay |
| Same key, changed cart/delivery/email | **409 RC002**, no order created, no stock touched |
| Genuine validation failure (RC001) | 400/409 as today; key is **not** consumed (no order row exists) |
| Two genuine purchases, same cart | Different keys (regenerated per attempt) → two orders, correct |
| Old client without a key | Falls through to `create_order` — identical to today |

## 3.4 Test matrix (clone/staging; never production)

| # | Case | Guest | Authenticated | Expected |
|---|---|---|---|---|
| T1 | Same key, same payload, sequential | ✔ | ✔ | 201 then 200, one order, same `ref`, replay flag |
| T2 | Same key, same payload, concurrent (2 parallel) | ✔ | ✔ | Exactly one order, one stock decrement |
| T3 | Same key, different item qty | ✔ | ✔ | 409, no new order, stock unchanged |
| T4 | Same key, different delivery/payment | ✔ | ✔ | 409 |
| T5 | Same key, different customer email | ✔ | ✔ | 409 |
| T6 | No key (legacy client) | ✔ | ✔ | 201, single order, current behaviour |
| T7 | Timeout after commit, retry with stored key | ✔ | ✔ | 200 replay, no duplicate |
| T8 | Rejected order (invalid postal / out of stock) | ✔ | ✔ | 400/409 RC001, key reusable afterwards |
| T9 | 11th request in 10 minutes | ✔ | ✔ | 429 rate limit, unchanged |
| T10 | Ownership disabled | ✔ | ✔ | `orders.user_id IS NULL` for both paths |
| T11 | Ownership enabled (only after 0006 verified) | ✔ | ✔ | authenticated order carries `user_id`, guest stays NULL |
| T12 | Admin sign-in + order status change unaffected | — | — | Admin flows unchanged |

Guest and authenticated runs must both be executed with `ORDER_OWNERSHIP_ENABLED` **false** first; T11 alone runs with it temporarily true on the clone.

## 3.5 Rollout and rollback

- **Rollout order:** apply `0008` → deploy code with `ORDER_IDEMPOTENCY_ENABLED = true`. If the migration must follow the code, ship with the flag `false` and the flag check short-circuiting to the 5-arg path (the `RC002` mapping is inert without keys).
- **Rollback:** set `ORDER_IDEMPOTENCY_ENABLED = false` (old RPC path), then `drop function public.create_order_idempotent(...)`, `drop index orders_idempotency_key_uidx`, drop the two columns. No order data is lost; existing orders keep their refs.

---

# W3 — Neutral AB Tech email branding

## 4.1 Files and exact change strategy

| File | Change |
|---|---|
| `lib/server/email-template-studio.ts` — `layout()` (header at `:203`, tagline at `:204`, footer at `:215`) | Add `brandName` and `brandTagline` options defaulting to `BRAND` (`"AB Tech"`) and a neutral line. Header renders `brandName`; tagline renders `brandTagline`; footer renders `brandName` + a neutral sentence, no service claims |
| `lib/server/email-template-studio.ts` — callers at `:692` (`renderStudioTemplate`) and `:741` (`renderStudioTemplateForSend`) | Pass `brandName` from the caller (send path from `store_name` when available, else `BRAND`), so the store name in **Settings** controls the email header |
| `lib/server/email-template-studio.ts` — 16 remaining strings (`:2, 82, 83, 102, 403, 430, 444, 461, 476, 490, 505, 564, 651, 658, 665, 672, 760`) | Rename to AB Tech; rewrite the five service-selling sentences so they describe **products and orders**, not infrastructure/security/managed services |
| `lib/server/email-center.ts:738, :845` | Replace `… — Racine IT` with the brand constant |
| `lib/server/email-send-templates.ts` | `contactLine` copy becomes brand-neutral; no service wording |
| `app/api/admin/products/import/route.ts:162` | Sample CSV brand slug `racine-it` → `sample-brand` |
| `app/admin/orders/[id]/email-preview/page.tsx`, `app/admin/quotations/[id]/email-preview/page.tsx` | No code change — they inherit the fixed wrapper; re-check visually |

## 4.2 Approved copy (neutral, no invented facts)

| Slot | Proposed value |
|---|---|
| Header | `AB Tech` (uppercase, letter-spaced, as today's styling) |
| Tagline | `Online electronics store` |
| Footer | `AB Tech — online electronics store. This message was sent in connection with your order or enquiry.` |
| Contact line | `Questions? Reply to this email or contact us at {{contact_email}}.` (address from `EMAIL_CONTACT_ADDRESS` / `RESEND_FROM_EMAIL`; **no** phone or address — none are confirmed) |

No claim about delivery times, warranty terms, company registration, service offerings or partnerships is introduced.

## 4.3 Template-by-template disposition

| Template id | Category | Action |
|---|---|---|
| `confirmation_commande` | Transactional | Keep; rename brand; keep order fields |
| `facture` | Transactional | Keep; rename brand |
| `devis` | Transactional | Keep; rename brand; keep quote wording (already generic) |
| `support_maintenance` | Transactional | Rename brand; replace "maintenance contract" wording with order-support wording |
| `relance_devis`, `relance_paiement` | Dunning | Rename brand; keep reminder wording |
| `email_test` | Utility | Rename brand |
| `offre_commerciale` | Commercial | Rewrite as a **product quotation** offer; remove service scope language |
| `campagne_marketing_b2b`, `prospection_b2b` | Commercial / B2B | **Do not** re-attribute IT services to AB Tech. Either rewrite as product-offer templates or remove them from the studio list (owner choice, Gate G5) |

## 4.4 Gating

- `EMAIL_CENTER_ENABLED` stays **false**; `/admin/templates`, `/admin/emails`, `/admin/followups`, `/admin/campaigns`, `/admin/webhooks` remain redirected.
- No Resend key is set; the customer-facing email launch is a separate, later gate.
- Order/quotation email **previews** are reachable today through admin order pages, so this work should land before any admin screenshots or customer demos.

---

# W4 — Demo products, unverified catalogue, "price on request"

## 5.1 Publication rules (what may be public)

A product may be visible (`products.is_active = true`) only when **all** apply:

1. It is a real, sellable product with a manufacturer model designation (not a generic title such as "Hot Sales For Original MacBooks Pro 16 M3 Gray 2025").
2. Its price is supplier-confirmed **or** it is explicitly marked `price_on_request` with supplier-confirmed availability.
3. Its stock figure comes from a supplier-confirmed source, not a seed value.
4. Its image is owned or licensed (today all 24 images are bundled demo assets).
5. Its specifications come from the manufacturer/distributor, not the seed placeholder set.

## 5.2 Current demo state (12 products)

- 5 products priced `$175.00`, 5 at `$150.00` — placeholder pricing, not offers.
- Titles include demo wording; specs are generic; images are demo assets.
- Stock values are seeded (18 / 11 / 7 / 24 plus seeded rows).

**Decision 8 consequence:** none of these may be presented as a genuine offer. Two compliant options:

| Option | Mechanism | Effect |
|---|---|---|
| **A. Preview disclosure** (recommended for a soft launch) | Keep products live but add a site-wide, unmissable "Preview catalogue — prices and stock are not final offers" banner; checkout remains test-mode | Store looks complete; no claim of a real offer |
| **B. Unpublish** (strict) | Set `products.is_active = false` on all 12 (existing admin toggle, **data change only, no migration**) | Storefront renders empty states; admin keeps full control |

Both are data/UI changes, no schema change. `products.is_active` already filters the storefront (`lib/server/catalog.ts:79`) and is editable in `ProductForm` (`:326`).

## 5.3 "Price on request" — schema gap

`products.price_cents` is `integer NOT NULL check (price_cents >= 0)`, so an unconfirmed price **cannot** be represented today without inventing a number. Approval of decision 7 therefore implies a small additive migration:

```sql
-- PROPOSED (0009_price_on_request.sql), only if decision 7 is exercised
alter table public.products
  add column if not exists price_on_request boolean not null default false;

alter table public.products
  add constraint products_price_consistency
  check ( (price_on_request and price_cents = 0)
       or (not price_on_request and price_cents > 0) );
```

Touch points if this migration is approved: `lib/products.ts` (`Product.priceOnRequest?`), `lib/server/catalog.ts` (select the flag), `components/ProductCard.tsx` and `ProductDetail.tsx` (render "Price on request" instead of a number), cart/checkout (block adding a price-on-request line and explain why), admin `ProductForm` (checkbox + validation). **Rollback:** drop the constraint and the column after reverting code.

If decision 7 is not exercised, no migration is needed: unconfirmed-price products simply stay unpublished (Option B).

## 5.4 Brand and colour data (dependent on G1)

- `products.brand_id` + `public.brands` exist only if 0004 is applied (Gate G1).
- Storefront loader does **not** select brand or colours today, so `Product.brand`/`Product.colours` are never populated and those facets stay hidden — no incorrect data is shown.
- Enabling brand filtering requires: 0004 verified → loader selects `brand:brands(name,slug)` → `Product.brand` populated → admin assigns brands → facet appears automatically.
- Colour filtering can be derived from existing `product_variants.options->>'colour'` and/or `specs` pairs — **no migration**, but only 2 variant rows exist today.

---

# 6. Dependencies and execution order

```
G1  Migration history verified (owner-run SQL, §2.2)          ── blocks W1, W4-brand
 │
G2  Backup taken + restore verified (§7)                      ── blocks G3
 │
G3  Clone rehearsal of 0007 + rollback + re-apply             ── blocks G4
 │
G4  FINAL APPROVAL → apply 0007 + deploy paired code (aliases, is_active filter, visibleCategories)
 │        └── same release: §2.1 files
 │
G5  Apply 0008 → deploy idempotency code (flag on)            ── independent of G4, may run first
 │
G6  W3 email branding merged (no send enabled)                 ── independent
 │
G7  W4 catalogue publication decision (Option A or B)          ── after G1 (+0009 if decision 7 used)
```

**Ordering rules**
- G5 (idempotency) is independent of the taxonomy and may ship before or after G4; do not ship both in the same window (isolate rollback).
- G6 (email branding) can ship any time; it changes nothing that is currently sent.
- W4's Option B (unpublish demo products) must **not** run before G4: an empty catalogue plus a migration window makes it impossible to tell a migration failure from an intentional empty store.
- Legacy aliases must **never** be deployed before G4 (§2.7).

---

# 7. Backup and recovery requirements

| Requirement | Detail |
|---|---|
| Supabase backup/PITR status | Owner confirms the plan tier provides daily backups and/or PITR, and the retention window, **before** G3 |
| Logical backup before G4 | `pg_dump --data-only --table=public.categories --table=public.products` (plus schema) stored outside the repo; this is the fastest restore path for a taxonomy mistake |
| Pre-state snapshot | 0007 already writes the exact pre-migration rows to `public._migration_0007_state`; keep it until rollback is no longer possible |
| Restore drill | Restore the dump into the rehearsal clone and run §2.6 + a storefront smoke before touching production (proves the backup is usable, not just taken) |
| Rollback owner | Named person authorised to run `0007_categories_taxonomy_rollback.sql` and the matching code rollback within the window |
| Order-data safety | `orders`, `order_items`, `inventory` are not touched by W1/W3/W4; W2 only adds nullable columns — a restore of catalogue tables can never lose an order |
| Evidence | Record the G1 query output, the backup identifiers, the rehearsal results and the §2.6 output in the launch log |

---

# 8. Approval checkpoints

| Gate | What the owner approves | Blocking |
|---|---|---|
| **G1** | Migration history result and the resulting plan adjustments | Everything |
| **G2** | Backup exists and has been restored once | 0007 |
| **G3** | Clone rehearsal passed, including rollback and re-apply | 0007 |
| **G4** | Final production approval: apply 0007 + deploy paired code, with a named window and write freeze | 0007 |
| **G5** | Apply 0008 + deploy idempotency (`ORDER_IDEMPOTENCY_ENABLED = true`) | Duplicate-order risk |
| **G6** | W3 copy (header, tagline, footer, per-template disposition) and whether B2B commercial templates are rewritten or removed | Email launch |
| **G7** | W4 publication option (A preview disclosure / B unpublish) and whether to add `price_on_request` (0009) | Catalogue launch |

---

# 9. Explicitly not in this plan

- No execution of any migration, no database write, no order creation, no secret or configuration change.
- No commit, push, merge or deploy.
- No customer, order, product or category data modified.
- Nothing here claims production readiness; all production changes remain gated by §8.
