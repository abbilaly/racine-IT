# AB Tech — Production Readiness Decision Plan

**Status:** planning artefact only. No source file, migration, database row, secret, commit, push or deployment was changed while producing it.
**Date:** 2026-11-13
**Branch / HEAD:** `freebuff/racine-it-admin-supabase` @ `089eb243d7b0a52fdeef7c9ab83bc096fbb0e59a`
**Production:** `https://racine-it.abbilaly.workers.dev/` (deployed build `215f8405…`, 2026-11-05 — older than this working tree)

---

## 0. Facts this plan rests on

| Fact | Evidence |
|---|---|
| Migration 0007 is **not applied** | `categories.is_active` absent from the live schema (code TODO in `lib/server/catalog.ts`); `/shop?category=smartphones` returns 0 products while `phones` returns 3 |
| Live taxonomy is the legacy 5 rows | 0007 precondition snapshot lists exactly `phones`, `laptops`, `tablets`, `audio`, `wearables` with ids and positions 0–4 |
| 0001 is applied | `orders.user_id`, `orders.ref`, legacy categories and the 5-argument `create_order` exist |
| 0002–0006 are **unverified** | No migration ledger was read; 0006's 6-arg RPC is not used by code (`ORDER_OWNERSHIP_ENABLED = false`) |
| Catalogue = 12 products | `supabase/seed.sql`, mirrored by the live storefront and by 0007's guard list of 12 exact slugs |
| Order creation has **no idempotency** | `orders` has `ref` unique only; `create_order()` generates `RIT-XXXXXXXX` server-side; no key column anywhere |

---

## 1. AB Tech branding — remaining customer-facing references

### 1.1 Public-facing content (must change before any customer email is sent)

| # | File / line | Surface | Customer-visible? | Proposed change | Needs business confirmation |
|---|---|---|---|---|---|
| B1 | `lib/server/email-template-studio.ts:203` | Email HTML **header** — `Racine&nbsp;IT` | **Yes** — every rendered email | Drive from `store_name` / brand constant; render `AB Tech` | No |
| B2 | `lib/server/email-template-studio.ts:204` | Email header subtitle — "Matériel et services informatiques pour les entreprises" | **Yes** | Replace with approved one-line description of AB Tech (electronics retail), or omit the subtitle | **Yes — copy required** |
| B3 | `lib/server/email-template-studio.ts:215` | Email **footer** — "Racine IT — matériel, infrastructure, infogérance et cybersécurité…" | **Yes** | Replace with neutral footer: brand name + contact line only. **Do not** re-attribute "infogérance / cybersécurité" to AB Tech | **Yes — service claims** |
| B4 | `lib/server/email-template-studio.ts` (13 further occurrences: lines 2, 82, 83, 102, 403, 430, 444, 461, 476, 490, 505, 564, 651, 658, 665, 672, 760) | Template subjects, variable labels, body copy, test-email copy | **Yes** for 430/444/461/476/490/505/564/651/658/665/672; admin-only for 2/82/83/102/760 | Rename to AB Tech; **review each B2B sentence** — several sell IT services, not electronics | **Yes — per template** |
| B5 | `lib/server/email-center.ts:738`, `:845` | Campaign/follow-up email footer — `… — Racine IT` | Yes, but gated | Replace with brand constant | No |
| B6 | `app/api/admin/products/import/route.ts:162` | Downloadable CSV sample row, brand slug `racine-it` | Yes (file download) | Use a neutral sample slug such as `sample-brand` | No |

**Consequence of leaving B1–B3:** the order-confirmation, quotation and invoice emails rendered by `lib/server/email-send-templates.ts` inherit the studio wrapper HTML. Renaming `store_name` (already done) does **not** change the header/footer — the strings are hardcoded in the wrapper. Today this reaches admins through `/admin/orders/[id]/email-preview` and `/admin/quotations/[id]/email-preview`; it reaches customers the moment `RESEND_API_KEY` is configured.

### 1.2 Gated admin surfaces (same strings, currently unreachable)

`EMAIL_CENTER_ENABLED = false` redirects `/admin/templates`, `/admin/emails`, `/admin/followups`, `/admin/campaigns`, `/admin/webhooks` to `/admin`. The template studio (`/admin/templates`) and its preview API are therefore **not** reachable in production today. Fix B1–B5 **before** turning that flag on, not after.

### 1.3 Internal identifiers — deliberately **not** renamed

| Identifier | Why it stays |
|---|---|
| `racine_admin_session` cookie (`lib/server/admin-auth.ts:17`) | Renaming invalidates every live admin session; do it in a planned window with a dual-read period |
| `racine-shop-v1` localStorage key (`lib/shop-store.tsx:22`) | Renaming silently empties every customer's cart, wishlist and compare list |
| `https://racine-it.abbilaly.workers.dev/...` fallback (`lib/server/auth.ts:432`) | This is the real deployed hostname, not branding |
| `RIT-` order reference prefix | Stored in `orders.ref` with a CHECK constraint; changing it needs a data migration and breaks every existing confirmation link |

**Rule applied:** no AB Tech service is invented. Where the old copy claims IT infrastructure, security or managed services (B2, B3, and templates `offre_commerciale`, `campagne_marketing_b2b`, `prospection_b2b`, `support_maintenance`), the copy must come from the owner.

---

## 2. Catalogue and taxonomy

### 2.1 Current (live) taxonomy — 5 rows, positions 0–4

| id | slug | label |
|---|---|---|
| `d68104ff-a80e-4281-a8a1-8189cd423c2c` | `phones` | Phones/Mobile |
| `84d6206c-c5f0-48ce-8bd6-f653e4a78ba7` | `laptops` | Macbook/PCs |
| `fd414ab7-0ef6-443f-a7f0-fb1a7234deed` | `tablets` | Tablets/Ipad Pro |
| `5857c9ab-c554-4c15-bb3d-b88b4ebc2b8d` | `audio` | Audio/Headphones |
| `c69827ba-1c33-4dd6-993e-ecc34cca9702` | `wearables` | Watches/Wearables |

### 2.2 Intended 0007 taxonomy — 14 active + 2 inactive

| Pos | slug | label | Origin |
|---|---|---|---|
| 1 | `computers` | Computers & Laptops | `laptops` row relabelled |
| 2 | `desktops` | Desktop Computers | new |
| 3 | `servers` | Servers | new |
| 4 | `networking` | Networking & Telecom | new |
| 5 | `components` | PC Components | new |
| 6 | `smartphones` | Smartphones & Tablets | `phones` row relabelled |
| 7 | `wearables` | Wearables & Smartwatches | relabelled |
| 8 | `gaming` | Gaming | new |
| 9 | `printers` | Printers & Scanners | new |
| 10 | `monitors` | Monitors & Displays | new |
| 11 | `multimedia` | Multimedia & Audio | new |
| 12 | `peripherals` | Peripherals & Accessories | new |
| 13 | `software` | Software & Licenses | new |
| 14 | `power` | UPS & Power | new |
| 15 | `tablets` | Tablets/Ipad Pro | **inactive, preserved** |
| 16 | `audio` | Audio/Headphones | **inactive, preserved** |

### 2.3 Product → final category mapping (all 12 products)

| # | Slug | Current | Final | Change type | Price | Stock |
|---|---|---|---|---|---|---|
| 1 | `apple-iphone-13-mini-128gb-pink` | phones | **smartphones** | row relabelled, product unchanged | $175.00 | 18 |
| 2 | `apple-iphone-13-mini-128gb-blue` | phones | **smartphones** | row relabelled | $175.00 | seeded |
| 3 | `apple-iphone-13-mini-128gb-white` | phones | **smartphones** | row relabelled | $150.00 | seeded |
| 4 | `macbook-pro-16-m3-gray-2025` | laptops | **computers** | row relabelled | $175.00¹ | seeded |
| 5 | `macbook-pro-16-m2-gray` | laptops | **computers** | row relabelled | $2,399.00 | seeded |
| 6 | `apple-ipad-pro-m1-12-inch-2022` | tablets | **smartphones** | **category_id moved** | $175.00¹ | 7 |
| 7 | `apple-ipad-pro-m1-11-inch-2021` | tablets | **smartphones** | **category_id moved** | $150.00¹ | seeded |
| 8 | `proove-wireless-headset-gaming-bliss` | audio | **multimedia** | **category_id moved** | $150.00 | seeded |
| 9 | `apple-airpods-3-2022` | audio | **multimedia** | **category_id moved** | $150.00 | seeded |
| 10 | `portable-wireless-speakers-2025` | audio | **multimedia** | **category_id moved** | $135.00 | seeded |
| 11 | `apple-watch-aluminum-case-pride-edition` | wearables | **wearables** | relabelled | $175.00¹ | 11 |
| 12 | `valdus-round-smart-watch-blood-pressure` | wearables | **wearables** | relabelled | $150.00¹ | 24 |

¹ Price is a demo value, not a supplier-confirmed retail price.

**Products that would become uncategorized or inaccessible: none**, provided the migration's guards pass. 0007 fails closed: it aborts if *any* product (regardless of `is_active`) has a NULL/unknown `category_id`, or if a product outside the expected 12 sits on `phones`, `laptops`, `tablets` or `audio`. If someone adds a product to `tablets`/`audio` between approval and execution, the migration refuses to run rather than orphan it — that is the desired behaviour, but it means **freeze catalogue writes during the apply window**.

### 2.4 Missing product information

| Gap | Detail |
|---|---|
| Brand | `products.brand_id` comes from 0004 (unverified/possibly unapplied) and is **not selected** by the storefront loader, so brand facets never render |
| Colour | Only inside `specs` and `product_variants.options` (2 variant rows for one iPhone); no first-class field, loader never maps it → colour facet never renders |
| Verified prices | 0 of 12 are supplier-confirmed; 5 products share `$175.00`, 5 share `$150.00` — clearly placeholder pricing |
| Model / SKU | Real SKU only on 2 variant rows; titles like "Hot Sales For Original MacBooks Pro 16 M3 Gray 2025" are not model designations |
| Images | 24 rows (primary + hover) referencing bundled demo files, not licensed supplier photography |
| Specs | 6 pairs per product, but generic and partly implausible (16" MacBook Pro at $175) |
| Coverage | After 0007: 10 of 14 active categories contain **zero** products |

### 2.5 Proposed migration plan (not executed)

**Phase A — read-only pre-flight (clone or read replica)**
1. Snapshot: `select id, slug, label, position from categories order by position;`
2. Product census: `select c.slug, count(*) from products p join categories c on c.id = p.category_id group by 1 order by 1;` → must be `phones 3, laptops 2, tablets 2, audio 3, wearables 2`.
3. Orphan check: `select count(*) from products where category_id is null;` → must be 0.
4. Ledger check for 0002–0006 (Supabase migration history) — 0007 assumes `categories` has no `is_active` and exactly 5 rows.
5. Confirm no other writer (admin session, import job) can create a product during the window.

**Phase B — rehearsal on a restored clone**
Run `0007_categories_taxonomy.sql`, then the verification set in §2.6, then `0007_categories_taxonomy_rollback.sql`, then verify the clone is byte-identical to the pre-migration snapshot (5 rows, labels, positions, `is_active` dropped, marker dropped, products back on `tablets`/`audio`).

**Phase C — production apply (owner-approved window)**
1. Set the storefront to read-only for catalogue writes (no new products/imports) — no schema change needed.
2. Apply 0007 in one transaction (it is already a single script with post-checks; any failure aborts everything, marker included).
3. Run §2.6 immediately.
4. Deploy the **paired code change** in the same window (§2.7). Until that deploy lands, the storefront still lists all categories (no `is_active` filter) — the two inactive rows would appear as empty categories.

**Phase D — post-apply cleanup (separate approval)**
Restore the `.eq("is_active", true)` filter in `lib/server/catalog.ts` (the `TODO(0007)`), and re-enable category visibility controls.

### 2.6 Post-apply verification (read-only)

```sql
-- 16 rows: 14 active (positions 1..14), 2 inactive (15,16)
select is_active, count(*) from categories group by 1 order by 1;
-- exactly 12 products, none on an inactive category
select count(*) from products;
select c.slug, count(*) from products p join categories c on c.id = p.category_id
  join categories a on a.id = p.category_id and a.is_active
  group by 1 order by 1;         -- smartphones 5, computers 2, multimedia 3, wearables 2
-- no orphan
select count(*) from products where category_id is null;
-- labels are the approved ones
select slug, label, position from categories where is_active order by position;
```

### 2.7 Paired code change required in the same window

After 0007 the slugs `phones`, `laptops`, `tablets`, `audio` **stop existing as active categories**, so any saved link (`/shop?category=phones`, old footer, bookmarks, ads) lands on an empty result set. Recommended: a legacy-alias map applied **only after** the migration:

| Old slug | New slug |
|---|---|
| `phones` | `smartphones` |
| `laptops` | `computers` |
| `tablets` | `smartphones` |
| `audio` | `multimedia` |

**Order matters:** applying these aliases *before* 0007 would break today's working links (pre-migration, `smartphones`/`computers`/`multimedia` hold 0 products). The alias map and the migration ship together.

### 2.8 Rollback

`supabase/rollback/0007_categories_taxonomy_rollback.sql` already exists, is mode-aware (reads `public._migration_0007_state`), aborts if the marker is missing, and in production mode restores the five rows exactly (labels, positions 2/3 for `tablets`/`audio`, reactivates them, moves products back, deletes the 11 new rows, drops `is_active`, drops the marker). Trigger rollback if any §2.6 check fails, if a product lands on the wrong category, or if storefront category counts differ from the expected 5/2/3/2.

**Known rollback caveat:** rollback drops `categories.is_active`, so any code reading it (see §2.9) breaks again — code must be rolled back with the schema, or keep `is_active` and only restore data.

### 2.9 Related defect the migration fixes (currently broken in production)

`lib/server/admin-data.ts` already selects and writes `categories.is_active`, but 0007 is the only migration that creates that column. Against the live database:

- `/admin/categories` (server component → `listCategories`) throws `42703 column does not exist` → admin categories screen fails;
- `createCategory` / `updateCategory` insert or update `is_active` → fail;
- `listActiveCategories` (used by product creation and CSV import) → fail.

This is not a new regression from this work; it is the cost of shipping admin code ahead of 0007. **It must be confirmed on first admin sign-in** and it makes 0007 a *repair* migration as well as a taxonomy change.

---

## 3. Checkout idempotency

### 3.1 Current behaviour (verified)

- `POST /api/orders` → rate limit (10 per IP / 10 min) → `createOrder(body)` → `createOrderSupabase` → `rpc("create_order", {p_items, p_customer, p_delivery, p_payment, p_note})`.
- `create_order()` (0001, `security definer`): validates, locks inventory rows, **decrements stock inside the loop**, computes shipping/total, generates `RIT-XXXXXXXX` by retrying on collision, inserts `orders` + `order_items`, returns `{ok, id, ref, …}`.
- `orders.ref` is `unique`; there is **no idempotency key** and no request fingerprint anywhere.
- The client sends no correlation id, and `parseOrderRequest` ignores unknown body fields.
- Current mitigation is copy only: an ambiguous failure returns `outcome: "unknown"` and checkout tells the customer to check email before retrying.

### 3.2 Failure modes today

| Scenario | Result |
|---|---|
| Worker aborts after the RPC commits (CPU/timeout, connection reset) | Order exists; customer sees "could not confirm"; a retry creates a **second order and decrements stock twice** |
| Customer double-taps submit / retries on flaky mobile network | Two orders |
| Two tabs of the same cart submitted | Two orders |
| PostgREST returns 5xx while the tx committed | Same as row 1 |
| Genuine rejection (validation, `RC001`) | Correctly safe to retry — already handled |

### 3.3 Proposed design (no database change in this phase)

**Key generation (client).** On first render of a non-empty checkout, create `idempotencyKey = crypto.randomUUID()` and store it in `sessionStorage` together with a fingerprint of the request (`items` slugs+qty, `delivery`, `payment`, `customer.email`). Reuse the stored key while the fingerprint is unchanged; generate a new key when the cart or delivery/payment/email changes; clear it after a confirmed success. This survives a reload after a timeout, which is exactly the case that duplicates today.

**Transport.** `CreateOrderRequest` gains optional `idempotencyKey?: string` (UUID v4, ≤ 64 chars). `parseOrderRequest` validates it and ignores it when absent. `createOrderSupabase` calls the new RPC **only when a key is present**, otherwise the existing 5-arg call — so the change is inert until keys are sent.

**Database (minimum, additive).**

```sql
-- PROPOSED — NOT APPLIED
alter table public.orders add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key)
  where idempotency_key is not null;
```

**RPC (minimum).** One new function with a **distinct name** so no overload ambiguity can arise with 0001's 5-arg and 0006's 6-arg versions:

```sql
-- PROPOSED — NOT APPLIED
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
begin
  -- Serialise concurrent requests that carry the same key.
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('order:' || p_idempotency_key, 0));
  end if;

  -- Replay: return the order this key already produced.
  if p_idempotency_key is not null then
    return query-into ...;   -- select the existing order + items, return the same shape with 'replayed', true
  end if;

  -- Otherwise: the existing 0001/0006 body verbatim, plus
  --   idempotency_key = p_idempotency_key
  -- in the orders insert, returning the same shape with 'replayed', false.
end;
$$;

revoke all on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) from public;
grant execute on function public.create_order_idempotent(jsonb, jsonb, text, text, text, text, uuid) to service_role;
```

The advisory lock (transaction-scoped) plus the partial unique index is the belt-and-braces pair: the lock serialises same-key requests so the replay branch wins, and the index guarantees at the storage layer that a duplicate can never be committed even if a future caller bypasses the lock.

**Response contract.** `replayed: false` → HTTP 201 (current contract preserved). `replayed: true` → HTTP 200 with the original `ref`, `total`, `createdAt`. Checkout navigates to `/order/{ref}` in both cases and shows "this order was already placed" copy for a replay. Because a key now identifies the attempt, the `unknown` outcome stops being a dead end: the UI can offer a **safe** retry, which the key collapses onto the original order.

**Concurrency.** Request A takes the advisory lock, inserts, commits. Request B blocks on the lock, then finds the order and returns it. No double decrement, no duplicate ref.

**Already-created orders.** If the key exists, the function never touches inventory; it returns the stored order. Mismatched reuse (same key, different cart) also returns the original order — first writer wins. Whether to *reject* a mismatched reuse instead is a product decision (see D4).

**Guest vs authenticated.** Identical: the key is generated client-side regardless of session. `p_user_id` stays optional and gated by `ORDER_OWNERSHIP_ENABLED`; ownership remains off until 0006 is applied and verified.

**Rate limiting interaction.** A retry with a valid key still consumes a slot in the 10-per-10-minutes IP budget. Trade-off: a replay is cheap and safe, but an attacker cannot use it to bypass throttling. Alternative (documented, not recommended now) is to resolve the key before the rate-limit check, which needs a read path in the Worker for no practical benefit.

**Backward compatibility.** Both the schema change and the new function are additive; the 5-arg and 6-arg functions are untouched. Deploy order can be either: migration first then code (preferred), or code first with `ORDER_IDEMPOTENCY_ENABLED = false` plus a fallback when PostgREST reports the function is missing. Old Workers keep calling the 5-arg path and behave exactly as today.

**Rollback.** Flip `ORDER_IDEMPOTENCY_ENABLED` to false (old RPC path), then `drop function public.create_order_idempotent(...)`, `drop index orders_idempotency_key_uidx`, `alter table public.orders drop column idempotency_key`. No order data is lost; keys are only extra columns.

**Test plan (must pass on a clone before production):**
1. Same key twice sequentially → **one** order, same `ref`, second call `replayed: true`, stock decremented once.
2. Same key, two concurrent requests → one order, one stock decrement, one 201 and one 200.
3. No key → byte-identical behaviour to today.
4. Simulated commit-then-timeout (kill the client after the RPC) → retry with the stored key returns the original order.
5. Different keys, identical cart → two orders (correct: two genuine purchases).
6. Same key with a changed cart → documented result (original order) or a clean `409`, per D4.
7. Validation failure (`RC001`) → no order, key unconsumed, retry allowed.
8. Rate limit still returns 429 after 10 attempts.
9. Guest and authenticated (once 0006 is applied) both work.

---

## 4. Prioritization

Scores: impact/risk 1–5 (5 = worst), effort 1–5 (5 = largest).

| Rank | Work | Customer impact | Security / financial risk | Effort | Dependencies | Blocks launch? |
|---|---|---|---|---|---|---|
| 1 | **0007 taxonomy + `is_active`** (§2) | 5 — wrong labels, 10 empty categories, admin category screens throwing | 3 — data migration, but guarded and reversible | 3 | Owner approval, clone rehearsal, catalogue write freeze, paired alias deploy | **Yes** — admin cannot manage categories/products today |
| 2 | **Checkout idempotency** (§3) | 4 — duplicate orders, wrong stock | **5** — money and inventory | 3 | 0006 status, new 0008 migration, client key | **Yes** for real order volume; duplicate orders are already possible |
| 3 | **Real catalogue + brands/colours/prices** (§2.4) | 5 — 12 placeholder products, 0 verified prices | 2 — no invented data allowed | 5 | Supplier pricing decision, 0004 verified, loader change | **Yes** — credibility |
| 4 | **Legacy slug aliases** (§2.7) | 3 — old links die at migration | 1 | 1 | Ships **with** #1 | Part of #1 |
| 5 | **Email branding B1–B5** (§1) | 4 — wrong company name in customer emails | 2 — misattributes services | 2 | Owner-approved copy; before `RESEND_API_KEY` | Not for a no-email launch; **yes** before email is enabled |
| 6 | **CSV sample + internal identifiers** (§1.3, B6) | 1 | 1 | 1 | None | No |

**Recommended sequence:** #1 (+#4 in the same window) → #2 → #3 (runs in parallel, longest lead time) → #5 → #6.

**Why #1 before #2:** the migration is the riskiest irreversible-feeling step and it also repairs admin screens; idempotency is purely additive and can land immediately after. Neither should ship without the other's rehearsal, but they are independent code paths.

---

## 5. Decisions required from the project owner

| # | Decision | Options | Default if no answer |
|---|---|---|---|
| **D1** | Approve migration 0007? | (a) approve with clone rehearsal + freeze; (b) approve code-side alias only and stay on legacy taxonomy; (c) defer | Stay on legacy; nothing applied |
| **D2** | Keep `tablets`/`audio` rows inactive (0007) or delete them? | (a) keep inactive (0007 as written); (b) delete after moving products (new migration) | Keep inactive |
| **D3** | Hide categories with 0 products in the storefront nav? | (a) hide until populated; (b) show all 14 with an empty state | Show all |
| **D4** | Approve idempotency migration 0008 (new `create_order_idempotent`, additive column + index)? And on key reuse with a **different** cart: return the original order, or reject with 409? | (a) return original; (b) 409 with "cart changed" | Return original |
| **D5** | Supply the AB Tech one-line description and footer copy replacing the IT-services claims (B2, B3, B4 template list) — or authorise removing the service claims entirely | (a) owner copy; (b) neutral brand-only footer | Neutral, brand only |
| **D6** | Confirm which of 0002–0006 are actually applied | Check Supabase migration history / dashboard | Treated as unverified; brand work paused |
| **D7** | Pricing policy for products without a supplier-confirmed price | (a) publish "price on request"; (b) hold products offline | Hold offline |
| **D8** | Keep the 12 demo products live at launch, or hide them until the real catalogue is loaded? | (a) keep with demo-pricing disclosure; (b) unpublish | Keep, disclosed |

---

## 6. Explicitly out of scope

No code, migration, data, secret, config, commit, push or deploy is included or performed here. Nothing in this plan claims the store is production-ready. The 0007 and 0008 SQL shown above is a proposal for review, not an applied change.
