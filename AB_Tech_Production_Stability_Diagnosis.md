# AB Tech — Production Stability Diagnosis

Read-only diagnosis. No file edits, no installs, no migrations, no database writes, no environment/secret/Cloudflare/Supabase changes, no deploy, no Git operations.

This document focuses strictly on the intermittent `Cloudflare error 1102 / HTTP 503` behavior on `https://racine-it.abbilaly.workers.dev/`.

## 1. What the symptom is

From prior read-only production checks:

- Some production requests return HTTP `503`.
- The small response body is `error code: 1102`.
- Each failing request has its own `cf-ray`, so these are real edge requests, not a single cached error page.
- Some 503 responses had `content-type: text/plain; charset=UTF-8` and `server: cloudflare`.
- Some 503 responses had `content-type: text/html; charset=utf-8`, `x-opennext: 1`, `x-powered-by: Next.js`, and `server: cloudflare`.
- The failures are intermittent and broad: they have shown up across unrelated route classes, including storefront pages, account pages, admin login, and order/product pages, while other requests to the same routes succeeded in the same window.

What error 1102 means in plain terms:

- It is a Cloudflare Worker execution failure at the edge.
- In practice, that usually means the Worker crashed, exceeded its CPU/time budget, or hit an unhandled runtime failure while processing the request.
- It is **not** one of the app’s own application error responses.

This distinction is important. If the app itself were returning a normal error, we would expect the app’s own response shape. Instead we see a platform error code.

## 2. Confirmed architecture

The deployment target is an OpenNext-generated Cloudflare Worker.

Confirmed from the workspace:

- Production Worker config exists in `wrangler.jsonc`.
  - name: `racine-it`
  - main: `.open-next/worker.js`
  - compatibility_date: `2026-09-23`
  - compatibility_flags include `nodejs_compat`
  - `assets` binding points at `.open-next/assets`
  - `observability.enabled` is `true`
  - No D1 binding is declared in the production `wrangler.jsonc`
- The production build entrypoint is `.open-next/worker.js`.
- The workspace also has a generated local dev config in `freebuff.wrangler.jsonc`. That file is **not** the production config. It adds local D1/R2/DO bindings for local development only.

So the current production Worker has:
- OpenNext middleware/handler path
- OpenNext server-function dispatch path
- OpenNext image handling path for `/_next/image` and `/cdn-cgi/image/*`
- An `ASSETS` binding for static assets
- Observability enabled
- No declared D1 binding in the production config

## 3. Confirmed shared request path

Every request goes through the same top-level sequence in `.open-next/worker.js`:

1. `runWithCloudflareRequestContext(request, env, ctx, async () => { ... })`
2. `maybeGetSkewProtectionResponse(request)`
3. If `/cdn-cgi/image/...` → `handleCdnCgiImageRequest(...)`
4. If `/_next/image` → `handleImageRequest(...)`
5. Otherwise → `middlewareHandler(request, env, ctx)`
6. If the middleware handler does not return a `Response` → dynamically import `./server-functions/default/handler.mjs` and dispatch through that handler

That means the shared path is:

- Worker entrypoint
- OpenNext request context initialization
- skew-protection check
- image-request handling for image optimizer paths
- Next.js middleware handler for normal pages/routes
- server-function handler bootstrap/dispatch for the matched route

Important detail:

- `runWithCloudflareRequestContext` calls `init(request, env)` once per isolate.
- `init` sets `initialized = true` after the first call.
- The first request in a given isolate therefore pays a small one-time initialization cost; later requests in that same isolate do not re-run that init.

So there is a real per-isolate startup component, but the current entrypoint does not call the app’s own Supabase/config imports in the Worker entrypoint itself.

## 4. Confirmed app-level shared execution paths

App-level shared paths that can be exercised by many different routes:

### 4.1 Root layout catalog load

`app/layout.tsx`:

- Exports `dynamic = "force-dynamic"`.
- Calls `loadShellCatalog()`.
- `loadShellCatalog()` races `loadCatalog()` against a 4000ms timeout.
- On timeout or error it falls back to `seedCatalog()`.
- It also does `void catalogue.catch(() => {})` to avoid an unhandled rejection.

`lib/server/catalog.ts`:

- `loadCatalog()` is a React `cache`-memoized async function.
- If Supabase is not configured, it returns `seedCatalog()` immediately.
- If Supabase is configured, it calls `fetchCatalogFromSupabase()`.
- If Supabase is configured and the query fails, it throws `catalogue-unavailable`.
- If Supabase is configured and returns no data, it also throws `catalogue-unavailable`.

`fetchCatalogFromSupabase()` does a `Promise.all` of five Supabase reads:

- `categories` select
- `products` select with embedded category relation
- `product_images` select
- `inventory` select
- `store_settings` maybeSingle

So when Supabase is configured, the application shell may perform several Supabase queries during root layout rendering on many pages.

### 4.2 Catalog-backed pages

These pages explicitly call `requireCatalog()` or `loadCatalog()`:

- `/`
- `/shop`
- `/product/[slug]`
- `/cart`
- `/checkout`
- `/compare`
- `/wishlist`

In the repository:

- `app/page.tsx` → `await requireCatalog()`
- `app/shop/page.tsx` → `await loadCatalog()`
- `app/cart/page.tsx` → `await requireCatalog()`
- `app/checkout/page.tsx` → `await requireCatalog()`
- `app/compare/page.tsx` → `await requireCatalog()`
- `app/wishlist/page.tsx` → `await requireCatalog()`
- `app/product/[slug]/page.tsx` → `await loadCatalog()`

Catalog-backed pages fail visibly when the catalogue is unavailable, instead of silently falling back to seed prices. That is the intended behavior from `lib/server/catalog.ts`.

### 4.3 Admin session checks

`lib/server/admin-auth.ts`:

- `getAdminSession()` first checks `isSupabaseConfigured()`.
- If Supabase is not configured, it returns `null` quickly.
- If Supabase is configured, it reads the admin session cookie, then calls `getServiceClient()` and `supabase.auth.getUser(...)`.
- Then, if there is a valid user, it creates a user-scoped client and queries `admin_roles`.

`lib/server/customer-auth.ts`:

- `getCustomerSession()` also first checks `isSupabaseConfigured()`.
- If Supabase is configured, it reads the customer session cookie, then calls `getServiceClient()` and `supabase.auth.getUser(...)`.

So when Supabase is configured, admin and customer session validation also go through Supabase on the relevant routes.

### 4.4 Order path

`lib/server/orders.ts`:

- `createOrder()` validates the request, then:
  - If Supabase is configured → `createOrderSupabase(...)`
  - Otherwise → `createOrderWithD1(...)`
- `getOrder()` does the same Supabase/D1 split for order lookup.
- `createOrderSupabase()` calls `getServiceClient()` and invokes the Supabase `create_order` RPC.
- `getOrderFromSupabase()` selects `orders` + `order_items` by reference.

So the order path can also touch Supabase when it is configured.

### 4.5 Email path

`lib/server/email.ts`:

- `sendEmail()` checks `RESEND_API_KEY`.
- If not configured, it returns `{ ok: false, error: "Email is not configured: set the RESEND_API_KEY Worker secret." }`.
- If configured, it does a `fetch(...)` to `https://api.resend.com/emails`.

So email is external, conditional on a secret being present, and not on Supabase.

## 5. Supabase and D1 initialization, queries, retries, timeouts, fallbacks

### 5.1 Supabase init

`lib/supabase/server.ts`:

- `readEnv()` reads `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` from `process.env`.
- If either is missing/empty, `readEnv()` returns `null`.
- `isSupabaseConfigured()` is true only when `readEnv()` is non-null.
- `getServiceClient()` creates the Supabase client once per module scope the first time it is called when Supabase is configured, and returns `null` when not configured.
- `createUserClient(accessToken)` creates a user-scoped Supabase client, used by admin/customer session and admin data queries.

So Supabase client creation is lazy and cached per isolate after the first call.

### 5.2 D1 init

`lib/server/orders.ts`:

- `getDb()` reads `env.DB` from the Cloudflare context.
- If `env.DB` is missing, it throws `OrderError("The order database is not configured for this environment.", 503)`.
- `ensureSchema(db)` lazily runs the D1 schema on first use and caches the promise in `schemaReady`.

Important:

- The production `wrangler.jsonc` does **not** declare a `DB` binding.
- Therefore, in the current production Worker, `getDb()` should throw `503` if any code path actually reaches `createOrderWithD1()` or `getOrderFromD1()`.

That means:

- If Supabase is configured, the order path should use Supabase, not D1.
- If Supabase is not configured, the order path should hit `getServiceClient() === null` in `createOrderSupabase()` and throw `503` there. It should not normally reach D1 in production because the production Worker has no `DB` binding.

So the D1 code path is mainly a local/preview fallback, not the expected production path for order creation/lookup.

### 5.3 Timeouts and retries

What I can confirm from the code:

- Root layout catalog load has a 4000ms shell timeout, with seed fallback.
- `lib/server/catalog.ts` has no visible retry loop on `fetchCatalogFromSupabase()`. A failed Supabase-configured catalogue read throws.
- Supabase client construction uses `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`.
- Image handling in `.open-next/cloudflare/images.js` uses `AbortSignal.timeout(timeoutMS)` for remote image fetches and a redirect loop limit.
- The app code does not show an unbounded retry loop around Supabase calls in the shared paths I inspected.

What I can note without assuming Supabase is the cause:

- Supabase calls have no explicit application-level timeout in the server modules I read.
- Supabase’s client can be configured with a custom `fetch` wrapper, but I did not see a custom fetch timeout wired in the server Supabase module here.
- So if Supabase is configured, catalogue and auth calls are at the mercy of the Supabase project/network/edge behavior, bounded only by the root layout’s 4s shell timeout for that one read.

## 6. Expensive operations, repeated queries, unbounded reads, loops, CPU-heavy transforms

I checked for the classic CPU-limit causes.

### 6.1 No obvious unbounded loop in the shared path

Confirmed:

- The Worker entrypoint’s `fetch` handler is not a loop.
- `runWithCloudflareRequestContext` runs the handler once per request.
- `middlewareHandler` is called once per request.
- The server-function handler import is dynamic, but it is imported only after the middleware handler returns something other than a `Response`, and only to dispatch the matched route.

So there is no visible infinite loop or recursive dispatch in the shared edge path.

### 6.2 No obvious per-request repeated full-catalogue rebuild

Confirmed:

- `loadCatalog()` is React-`cache` memoized per request.
- The app shell reads the catalogue once per request and shares it.
- Catalog-backed pages also rely on that per-request cached read.

So the app is not repeatedly refetching the whole catalogue inside one request in the shared path.

### 6.3 What can still be expensive

Even without an unbounded loop, these are the paths that can consume meaningful CPU/time when Supabase is configured:

- Root layout `fetchCatalogFromSupabase()`:
  - 5 parallel Supabase queries
  - JSON normalization into `Product[]` and `CategoryOption[]`
  - Sorting product images and computing stock across inventory rows
- Admin and customer session checks:
  - cookie read
  - Supabase auth call
  - role/user lookup when configured
- Order creation:
  - request validation
  - Supabase RPC to `create_order`
- Order lookup:
  - Supabase `orders` + `order_items` select

Also potentially expensive in a broader sense, though not loop-based:

- `lib/server/admin-data.ts` has some `listCustomers()` and `salesReport()` / `bestSellingProducts()` style aggregations that iterate result sets in memory. Those are admin reports, not storefront hot paths, but they are real Supabase-driven aggregations.

### 6.4 Spec normalization is not currently a big CPU sink, but it is not normalized either

`lib/server/catalog.ts` and `lib/server/admin-data.ts` read `specs` as `{ name, value }[]` and pass it through.

So:

- There is no huge in-request spec parsing explosion in the current code.
- But there is also no structured facet indexing. That is more of a filtering/feature issue than a CPU issue in the current code, though it can matter if you later add faceted search.

## 7. Generated Worker entrypoint and configuration findings

Confirmed from `.open-next/worker.js`:

- The Worker imports and uses OpenNext helpers for image handling and request context.
- The server-function handler is imported dynamically only for non-image, non-middleware-returning requests.
- There is no app-level Supabase import in the Worker entrypoint itself.

Confirmed from `wrangler.jsonc`:

- Production Worker has `ASSETS`, `observability`, and `nodejs_compat`.
- Production Worker has no D1 binding.

Confirmed from `freebuff.wrangler.jsonc`:

- Local dev Worker has D1 `DB`, R2 buckets, and durable object bindings.
- That file is the local development config, not the production config.

Confirmed from `open-next.config.ts`:

- It uses `defineCloudflareConfig()` with no visible custom overrides in the workspace copy.

So the production Worker configuration is conventional for an OpenNext Cloudflare deployment, with ASSETS + observability and no D1 binding.

## 8. What Cloudflare logs/metrics are accessible from here

### 8.1 What is available in the workspace

- Build-time artifacts under `.open-next/`.
- The repository source tree.
- Local dev tooling: `wrangler dev --local` with `freebuff.wrangler.jsonc`.
- Local logs that have already been captured during earlier local runs, such as `.wrangler-dev.log` and the local dev server logs in the workspace.

### 8.2 What is not available from this environment

From this environment, I do **not** have access to:

- Cloudflare Workers Logs for the production Worker.
- Cloudflare Workers Analytics, including request-level timing/CPU metrics for the failing requests.
- Cloudflare deployment/instance-level runtime diagnostics for the failing requests.
- The deployed production Worker’s actual environment/secret values.
- Direct inspection of the live Supabase project’s current schema/migration state or live query performance.

That is the key limitation.

So from here I can:

- infer the failure class from the error code and the code paths;
- inspect the code that runs on every request and the shared Supabase/D1 paths;
- confirm that the build and local dev path are coherent;

But I cannot:

- read the failing request logs;
- see which requests failed and what they were doing internally;
- confirm the exact exception or CPU split;
- confirm the production Supabase posture directly.

## 9. Confirmed findings

### Finding 1 — The failures are a platform error code, not an app error page

Confirmed:

- Some production responses are HTTP 503 with body `error code: 1102`.
- That is Cloudflare’s Worker execution failure signature.
- The app’s own error responses are different.

### Finding 2 — The shared request path is the same for many failing routes

Confirmed:

- Image paths, middleware, and server-function dispatch are the shared edges.
- `runWithCloudflareRequestContext` + skew protection + middleware handler + server-function handler is the common sequence.

### Finding 3 — There is a per-isolate one-time init, then per-request dispatch

Confirmed:

- `init()` in `.open-next/cloudflare/init.js` runs once per isolate.
- The Worker entrypoint does not import Supabase itself.
- The server-function handler is imported dynamically after the middleware handler.

### Finding 4 — The app has shared Supabase-dependent paths when Supabase is configured

Confirmed:

- Root layout catalog read
- Catalog-backed pages
- Admin session checks
- Customer session checks
- Order create/lookup when Supabase is configured

These are the main app-side shared paths that can add real per-request work when Supabase is configured.

### Finding 5 — The app has a D1 fallback only when Supabase is not configured

Confirmed:

- `lib/server/orders.ts` uses Supabase when configured, D1 otherwise.
- Production `wrangler.jsonc` has no D1 binding.
- So the D1 path is not the expected production order path; it is mainly local/preview.

### Finding 6 — Supabase calls have no visible application-level timeout in the server modules I read

Confirmed:

- `lib/supabase/server.ts` does not set an explicit fetch timeout I could see.
- `lib/server/catalog.ts` does not retry Supabase reads.
- The only visible timeout in the shared app path is the 4000ms shell catalog timeout in `app/layout.tsx`.

### Finding 7 — The current code does not have an obvious unbounded loop or recursive dispatch in the shared edge path

Confirmed by inspecting:

- `.open-next/worker.js`
- `.open-next/cloudflare/init.js`
- `.open-next/cloudflare/skew-protection.js`
- `lib/server/catalog.ts`
- `lib/server/orders.ts`
- `lib/server/admin-auth.ts`
- `lib/server/customer-auth.ts`
- `lib/supabase/server.ts`

## 10. Suspected causes and supporting evidence

These are ranked hypotheses, with evidence, not confirmed root causes.

### Hypothesis A — Platform-side Worker failure under some condition

Evidence:

- Error 1102 is a Worker execution failure code.
- Failures are intermittent and appear across unrelated route classes.
- The same routes often succeed on other attempts.

Why this is a strong hypothesis:

- A route-specific bug would usually be more localized.
- A broad intermittent failure is more consistent with something shared: per-isolate startup, a shared dependency, a platform edge condition, or request handling under load/timing.

What would confirm it:

- Cloudflare Workers Logs/Analytics showing the failing requests and any unhandled exceptions or CPU/timing spikes.

### Hypothesis B — If Supabase is configured in production, Supabase-dependent shared paths contribute to time/CPU pressure

Evidence:

- When Supabase is configured, many routes touch Supabase:
  - root layout catalogue
  - catalogue-backed pages
  - admin/customer auth
  - order create/lookup
- The app has a 4s shell catalog timeout, but catalogue-backed pages call `requireCatalog()` and would fail rather than fall back.
- Supabase calls have no visible app-level timeout in the server modules I read.

Why this is a strong hypothesis **if** Supabase is configured:

- A slow/flaky/unreachable Supabase dependency can make a broad set of routes expensive or fail.
- Supabase is the main shared external dependency in the current app.

What would confirm it:

- Production Worker logs showing Supabase calls on the failing requests.
- Confirmation that Supabase is configured in production.
- Request timing/CPU evidence correlating failures with Supabase-dependent routes.

I am explicitly **not** assuming this is the cause. It is conditional on Supabase being configured.

### Hypothesis C — If Supabase is not configured in production, the 503s are less likely to be app-query-driven

Evidence:

- `isSupabaseConfigured()` returns false when the required env vars are missing.
- In that mode, `loadCatalog()` returns the seed catalogue immediately and auth/session checks return null quickly.
- Order creation falls back toward the D1 path, but the production Worker has no `DB` binding, so `getDb()` would throw 503 if reached.

Why this matters:

- If production is running without Supabase configured, then the broad Supabase-dependent paths are mostly no-ops or fast nulls.
- In that case, the 503s are more likely platform/runtime/internal than Supabase-query-driven.

What would confirm it:

- The production environment’s actual Supabase secret posture.
- Cloudflare logs/metrics for the failing requests.

### Hypothesis D — A local-dev-vs-production posture mismatch could be part of the story

Evidence:

- `freebuff.wrangler.jsonc` is the local dev config and adds D1/R2/DO bindings.
- Production `wrangler.jsonc` does not declare D1.
- Local dev uses `wrangler dev --local` with that generated config.

Why this is worth naming:

- The app has two different execution postures: Supabase-backed and local/D1-backed.
- If the production deployment posture is inconsistent with what the code expects for order handling, that could create surprising failures for order-related paths.
- But this is not confirmed as the 1102 cause.

### Hypothesis E — Email or other optional external fetch could matter only where it is actually used

Evidence:

- `lib/server/email.ts` calls Resend only when `RESEND_API_KEY` is configured.
- Email is not on the critical storefront path for most routes.

Why this is low likelihood for the broad 1102 pattern:

- The failures are broad and include pages that do not send email.
- Email is conditional and external, so it could matter only if a route actually tries to send and the fetch misbehaves.
- I am not ruling it out for specific email-touching requests, but it is not the obvious cause of broad intermittent 503s.

## 11. What still requires Cloudflare dashboard access

These cannot be resolved from this workspace alone:

1. Which requests are actually failing with 1102 in production.
2. Whether those failures show unhandled exceptions, stack traces, or specific failing internal operations.
3. Whether the failures correlate with Supabase calls, image handling, middleware, or server-function dispatch.
4. Whether there is CPU/wall-time pressure on the failing requests.
5. Whether the failures cluster by time, route class, client, or isolate recycling.
6. Whether the production Worker environment has Supabase configured.
7. Whether the production Worker environment has any other service binding or secret inconsistency affecting order handling.

Also not confirmable from here:

- Live Supabase project health, latency, RLS behavior, or query performance.
- The exact production Supabase schema/migration state beyond what the repository says it intends.

## 12. Recommended fixes ranked by impact and risk

The ranking is about reducing the likely shared pressure and narrowing the unknowns, without changing launch scope or inventing fixes.

### 1 — Highest priority: confirm the production Supabase posture and pull production Worker logs/metrics

Impact: high  
Risk: low (investigation only)

Why first:

- The difference between “Supabase configured” and “Supabase not configured” changes which shared paths are active.
- The exact failure cause is not confirmable without production observability.

Concrete actions:

- Confirm whether the production Worker is intended to run with Supabase configured.
- If it is, verify Supabase reachability from the deployed Worker and whether any Supabase-dependent path is slow or failing.
- Pull Cloudflare Workers Logs/Analytics for the 1102/503 requests.
- Look for exception signatures, timing spikes, and whether failures correlate with catalogue/auth/order paths.

### 2 — Add bounded Supabase fetch behavior for shared server paths

Impact: medium to high if Supabase is configured  
Risk: medium

Why:

- Today there is no visible app-level Supabase fetch timeout in the server modules I read.
- A stalled Supabase call can delay or destabilize shared paths.
- A bounded fetch and clear failure behavior reduce time pressure and make failures less likely to blow up broadly.

Concrete direction:

- Wrap Supabase RPC/ REST calls used in shared hot paths with a timeout.
- Fail fast with clear errors instead of letting a slow external call eat CPU/time.
- Keep catalogue shell timeout behavior where it already exists.

This is not assuming Supabase is the cause. It is making a shared dependency less likely to dominate request time if it is configured.

### 3 — Make the shared catalog/auth paths fail gracefully without broad blast radius

Impact: medium  
Risk: medium

Why:

- When Supabase is configured, a catalogue failure currently can throw `catalogue-unavailable` from `loadCatalog()`.
- Catalog-backed pages then fail visibly, which is the intended behavior for those pages.
- The shell already tolerates failure for chrome-only rendering.

Concrete direction:

- Keep the shell fallback behavior for chrome.
- Keep catalogue-backed pages honest rather than serving stale seed prices.
- Consider whether any shared server path can trip a broad 503 in a way that is wider than necessary, and narrow it if so.

### 4 — Clarify production order database posture

Impact: medium  
Risk: medium

Why:

- Order creation/lookup chooses Supabase or D1 based on configuration.
- Production `wrangler.jsonc` has no D1 binding.
- The app should have one clear production order path and one clear failure mode if that path is unavailable.

Concrete direction:

- Confirm the intended production order path.
- Ensure the intended path is the one actually available in production.
- Make the “not configured” failure mode explicit and consistent.

### 5 — Lower priority: reduce per-request shared work where it is obviously unnecessary

Impact: low to medium  
Risk: low to medium

Examples that may be worth reviewing later:

- Any shared server path that does more work than the route needs.
- Repeated revalidation or re-querying that could be narrowed.
- Admin-side heavy aggregations that are fine internally but not relevant to storefront stability.

I would not do this speculatively before the failure cause is clearer.

### 6 — Lower priority: verify image-handling behavior under real traffic

Impact: low for current storefront stability  
Risk: low

Why:

- Image handling is its own path with timeouts and redirect limits.
- It is not the obvious cause of broad 1102s, but it is a shared edge path.
- It is worth confirming it is not contributing in the specific image-optimizer cases if those appear in logs.

## 13. Exact tests needed before any deployment

Before any change is deployed, these should be verified:

### 13.1 Confirm the production posture

- Confirm whether Supabase is configured in production.
- Confirm whether the production Worker has the intended bindings/secrets for order handling.
- Confirm whether email/Resend is configured in production.
- Confirm whether `CUSTOMER_ALLOW_REGISTRATION`, `NEXT_PUBLIC_SITE_URL`, and other relevant env/secret values match the intended behavior.

### 13.2 Production observability tests

- Capture Cloudflare Workers Logs for failing requests, if available.
- Capture any request timing/CPU evidence for failing requests, if available.
- Identify the failing request class and the internal operation that precedes the failure, if logs allow.

### 13.3 Functional regression tests

- Repeat the same read-only production probe set that was used in the earlier investigation:
  - storefront pages
  - product page
  - account pages
  - admin login
  - order lookup by reference
- Confirm intermittent 503/1102 frequency before and after any change.
- Confirm that successful responses still render as expected.

### 13.4 Local verification for any code change

- Ensure `tsc --noEmit` still passes.
- Ensure `opennextjs-cloudflare build` still produces a Worker.
- Run local Wrangler dev smoke tests for the same route classes.
- If Supabase/D1 posture is changed, verify both the intended primary path and the intended fallback behavior.

### 13.5 Failure-mode tests

- Simulate Supabase unavailability for the configured path and confirm the app fails in the intended, bounded way.
- Simulate unavailable order database path and confirm the intended failure mode.
- Confirm that a stalled external call does not dominate a request unboundedly after any timeout changes.

## 14. Bottom line

- The intermittent 1102/503 behavior is a platform Worker execution failure, not one of the app’s normal error responses.
- The same shared request path serves storefront, product, account, and admin requests, so a broad intermittent failure is consistent with a shared cause rather than a single page bug.
- The app’s main shared external dependency is Supabase, and Supabase-dependent paths exist for the shell, catalogue-backed pages, auth, and orders when Supabase is configured.
- The app also has a D1 fallback for orders when Supabase is not configured, but the production Worker does not declare a D1 binding.
- I could not find an obvious unbounded loop or recursive dispatch in the shared edge path.
- I could not confirm the exact cause without Cloudflare Workers Logs/Analytics and confirmation of the production Supabase posture.

So the remaining work is mostly observability and posture confirmation, not a definitive code fix yet.

No changes were made to the repository in this diagnosis.
