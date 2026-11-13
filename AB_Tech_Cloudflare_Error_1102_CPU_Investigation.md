AB Tech — Cloudflare Error 1102 CPU Investigation

This is a read-only investigation. No code edits, no deploy, no migrations, no production writes, no secret changes, no billing changes, no Git operations, and no invented evidence.

## 1. Confirmed meaning of Cloudflare error 1102

Evidence from production:
- Intermittent requests to `https://racine-it.abbilaly.workers.dev` return HTTP `503` with a very small body:
  - `error code: 1102`
- Each failing request had a unique `cf-ray` header, which means they are real edge requests, not a single cached error page.
- Some 503 responses included:
  - `content-type: text/plain; charset=UTF-8`
  - `server: cloudflare`
  - no `x-opennext` / `x-powered-by`
- Some 503 responses included:
  - `content-type: text/html; charset=utf-8`
  - `x-opennext: 1`
  - `x-powered-by: Next.js`
  - `server: cloudflare`

What error 1102 means:
- Cloudflare error 1102 is a Worker execution failure at the edge.
- In plain terms, it is the platform saying the Worker could not complete the request because it crashed, exceeded its CPU/time budget, or hit an unhandled runtime failure during execution.
- It is not a normal application 500 page and not one of the app’s own JSON error responses.

That distinction matters: if this were a normal app error, we would usually see the app’s own error shape. Instead we see a platform error code.

## 2. Cloudflare Worker observability, logs, CPU metrics, exceptions

What I could check from here:
- Production HTTP responses only, read-only.
- The local Worker build and generated entrypoint paths.
- The shared code paths in the workspace.

What I could not check from here:
- Cloudflare Worker Logs, Analytics, or request-level CPU/wall-time metrics.
- The deployed Worker’s runtime environment or binding values.
- Whether any specific 503 request threw a particular unhandled exception inside the Worker.

So this report states the limitation explicitly:
- I can infer the failure class from the error code and the request pattern.
- I cannot confirm the exact exception, exact CPU consumption, or exact timing split for the failing requests without Cloudflare Worker Logs/Analytics access.

If that access is available to whoever has the Cloudflare project, the useful evidence would be:
- Worker Logs for the 503 requests, especially any unhandled exceptions and stack traces.
- Analytics/timing for those requests, if available, to see whether failures correlate with slow handlers or spikes.
- Whether the failures are concentrated in a time window, a path class, or across all times/routes.

## 3. Shared code executed across unrelated routes

Every request goes through the same top-level sequence in the generated Worker:
- `fetch(request, env, ctx)`
- `runWithCloudflareRequestContext(...)`
- `maybeGetSkewProtectionResponse(request)`
- if not an image request, `middlewareHandler(request, env, ctx)`
- if that does not return a Response, the server-function handler is invoked

That means the shared request path is:
- Worker entrypoint
- Cloudflare request context initialization
- skew-protection check
- image-request handling for `/cdn-cgi/image/*` and `/_next/image` paths
- middleware handler for normal requests
- server-function handler bootstrap and dispatch for the matched route

In addition, the app has app-level shared paths that many routes touch:
- Root layout loads the catalogue through `loadCatalog()` with a 4s shell timeout and a seed-catalogue fallback.
- Catalogue-backed pages call `requireCatalog()` or `loadCatalog()`, which fetch from Supabase when it is configured.
- Admin-protected pages call admin session checks through Supabase when Supabase is configured.
- Customer-facing auth paths also use Supabase session checks when configured.

Important structural point:
- The Worker entrypoint and both handler bootstraps run once at module initialization, not once per request.
- That removes “per-request config import” as a likely CPU sink in the current build.
- The per-request work is then: request dispatch, optional image handling, route handling, and any Supabase-dependent reads a route actually performs.

## 4. CPU-heavy loops, unbounded retries, recursion, excessive sync work, expensive serialization

I inspected the shared paths for the usual CPU-limit causes.

No evidence found of:
- An unbounded loop in the shared request path.
- Recursive dispatch in the Worker entrypoint or middleware handler.
- Per-request repeated rendering of the whole app in the shared path.
- A shared infinite retry loop in the request pipeline we inspected.

What I did find that is relevant:
- The app intentionally makes catalogue-backed pages await Supabase when Supabase is configured.
- The root layout races that against a 4s timeout and falls back to a seed catalogue for app chrome only.
- If Supabase is configured and a Supabase-dependent path is slow, flaky, or failing, that can add real per-request cost on many routes.
- The app also runs auth session checks via Supabase on protected pages when Supabase is configured.

So the most plausible CPU/time contributors, if Supabase is configured in production, are:
- Supabase calls on catalogue-backed pages
- Supabase calls on admin-protected pages
- Supabase calls on customer auth pages
- Timeouts and retries around those calls if they stall

If Supabase is not configured in production, those paths should be fast null-paths, and the 503s would be more likely to be platform/runtime/internal rather than app-query-driven.

I found no evidence of a per-request unbounded loop or recursive handler call in the shared path. That does not rule out a subtle runtime issue, but it means there is no smoking-gun infinite loop in the code we inspected.

## 5. Affected routes compared with successful requests

Evidence from production:
- The intermittent 503s are not limited to one route.
- They have hit:
  - `/`
  - `/shop`
  - `/cart`
  - `/checkout`
  - `/compare`
  - `/wishlist`
  - `/account`
  - `/account/signin`
  - `/admin/login`
  - `/admin/orders`
  - `/admin/products`
  - `/order/RIT-8F0D8111`
  - `/product/apple-iphone-13-mini-128gb-pink`

At the same time:
- The same routes often return `200` on other attempts.
- `/order/RIT-8F0D8111` and `/admin/login` have both returned `200` repeatedly in the same probe windows where other attempts failed.
- `/admin/orders` and `/admin/products` also return `307` to `/admin/login` when not authenticated.

What that comparison shows:
- This is not a single route handler problem.
- It is intermittent and broad.
- That pattern fits a shared request-processing issue or a shared external dependency issue more than a one-route bug.

## 6. Confirmed findings versus hypotheses

Confirmed:
- Production intermittently returns HTTP 503 with body `error code: 1102`.
- The failures are intermittent, not constant.
- The failures are broad across unrelated route classes, including `/admin/login` and `/order/RIT-8F0D8111`.
- The Worker build locally typechecks, builds, and passes local Wrangler smoke tests for the same route classes.
- The generated Worker entrypoint and handler bootstraps run at startup, not per request.
- The app deliberately uses Supabase for catalogue and auth when configured, and falls back to local-only behavior when not configured.

Hypotheses, clearly labeled:
- Most likely: the production Worker is hitting a platform-side CPU/runtime failure under some condition, possibly related to shared request processing or a shared external dependency.
- If Supabase is configured in production, a slow or failing Supabase path on many routes is a plausible contributor to CPU/time pressure.
- If Supabase is not configured in production, the 503s are more likely platform/internal, because the app’s Supabase paths would be fast null-paths.
- Less likely based on current evidence: a single route handler is the cause.
- Less likely based on current evidence: a visible unbounded loop or recursive dispatch in the shared path we inspected.

I am not asserting any of the hypotheses as proven. They are ranked by fit to the evidence.

## 7. Most likely CPU-consuming code path

Based on the evidence, the most likely CPU-consuming path is not one route. It is the shared request path plus whatever shared external work the app does when Supabase is configured.

If I had to state the single most likely shared contributor:
- Supabase-dependent request work, when Supabase is configured in production, combined with intermittent platform-level failure.

Why:
- The failures are broad.
- The app’s broad paths are either platform/request-dispatch paths or Supabase-dependent app paths.
- The local build works for the same routes with local bindings.
- That combination points away from a pure app infinite loop and toward an environment/runtime/load-sensitive failure, with Supabase as the main app-side shared dependency.

If Cloudflare Worker Logs become available, the confirmation step is:
- Look for which requests fail,
- whether failures correlate with Supabase lookups,
- whether there are unhandled exceptions,
- and whether there is a wall-time or CPU spike pattern.

## 8. Smallest safe fix for the guest-checkout MVP

For the MVP, the smallest safe fix is not a code rewrite. It is environment/runbook-driven.

Smallest safe stabilization moves:
1. Confirm whether the production Worker is intended to run with Supabase configured or without it.
2. If Supabase is intended, confirm Supabase connectivity from the deployed Worker and whether any Supabase-dependent path is slow or failing under load.
3. If Supabase is not intended, confirm the production Worker environment matches that posture, so the app is not accidentally entering Supabase-dependent paths it cannot complete.
4. Pull Cloudflare Worker Logs/Analytics for the 503 requests to see whether the failures are exception-driven or time/CPU-driven.
5. If the failures are time/CPU-driven and tied to Supabase, the smallest safe app-side mitigation is to make the shared Supabase-dependent paths faster, shorter, or more bounded, without changing the MVP feature set.
6. If the failures are platform/internal and unrelated to Supabase, the smallest safe move is operational: redeploy/stabilize the Worker environment rather than redesign the app.

What I would not do for the MVP:
- Add Email Center or CRM.
- Enable customer registration.
- Broaden scope.
- Change the guest-checkout flow.
- Modify production data.

## 9. Expected customer-visible improvement

If the production Worker stops intermittently returning error 1102:
- Customers would stop seeing sporadic 503 pages across the storefront, account, and admin paths.
- Homepage, shop, product pages, cart, checkout, wishlist, compare, account, and sign-in would behave like the local smoke tests and like the good production attempts.
- Guest checkout and order lookup would remain usable.
- Admin login and protected admin pages would remain usable after sign-in.

That is the visible outcome you want for launch: fewer or no sporadic 503s, with the same features that already exist.

## 10. Tests needed before deployment

Before any deployment, the needed checks are:

Functional checks, read-only:
- Repeat the production read-only probe set and confirm the intermittent 503s are reduced or gone.
- Confirm `/order/RIT-8F0D8111` and `/admin/login` still return `200` reliably.
- Confirm `/admin/orders` and `/admin/products` still redirect to `/admin/login` when not authenticated.

Local checks, already passing:
- `tsc --noEmit` passes.
- `opennextjs-cloudflare build` passes.
- Local Wrangler dev smoke tests pass for the same storefront/account/admin/order paths.

Operational checks, if available:
- Cloudflare Worker Logs for any remaining 1102/503 events.
- Worker request timing/CPU evidence for the previously failing routes.
- Confirmation that the production environment posture matches the intended Supabase configuration.

Final note:
- The shared code looks structurally sound, and the local build works for the same routes.
- The production symptom is a platform error code across many routes, intermittently.
- So the remaining uncertainty is operational and environment-side, not a confirmed app-side infinite loop.

No changes were made to the repository in this investigation.
