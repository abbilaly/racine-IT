AB Tech — Production 503 Investigation & MVP Launch Stabilization

This report is read-only. No deployment, migration, production write, secret change, billing change, or Git operation was performed.

## 1. Exact cause of the 503 errors, with evidence

The intermittent production 503s return a very small body:

- `error code: 1102`

Evidence I collected against `https://racine-it.abbilaly.workers.dev`:

- The 503s are intermittent and affect many unrelated route classes, including routes that should not depend on the Supabase catalogue:
  - `/admin/login`
  - `/order/RIT-8F0D8111`
  - `/product/apple-iphone-13-mini-128gb-pink`
- Storefront routes that intermittently 503 include `/`, `/shop`, `/cart`, `/checkout`, `/compare`, `/wishlist`, `/account`, `/account/signin`.
- Admin list routes `/admin/orders` and `/admin/products` consistently return `307` to `/admin/login` when not authenticated, and sometimes `503` when the Worker itself is in a bad state.
- When a 503 occurs, the response body is consistently `error code: 1102`, not the app’s normal 404 page, not a route-specific error message, and not a Supabase error string.
- Production header evidence on a 503-prone request shows:
  - `content-type: text/plain; charset=UTF-8` on some 503s
  - `content-type: text/html; charset=utf-8` plus `x-opennext: 1` and `x-powered-by: Next.js` on some 503s
  - `server: cloudflare`
  - `cf-ray` present

What this points to:

- The error body is a serialized code, not a normal application error page. That strongly indicates the error is coming from the platform/Worker request pipeline rather than a deliberate app error response.
- Because the intermittent 503s hit routes with very different code paths, including `/admin/login` and `/order/RIT-8F0D8111`, the most likely class of cause is environment/runtime instability in the deployed Worker rather than one specific route handler.
- This is also consistent with the earlier finding that production is intermittently unstable across many routes, not just catalogue-backed ones.

Likely causes, in order of likelihood:

1. The deployed Worker environment is intermittently unhealthy or its bindings/environment are not fully ready or consistent. The tiny `error code: 1102` body is the kind of message you see from a platform-side fetch/worker dispatch failure path.
2. If the deployed Worker is missing or intermittently unable to reach required environment bindings or Supabase connectivity, that can produce broad 503s.
3. A less likely but possible cause is an OpenNext runtime/edge serialization or dispatch failure in the deployed Worker build. I cannot prove that from outside the Worker, but the `error code: 1102` body fits that general pattern.

What I could not confirm from outside production:

- I cannot read the deployed Worker’s runtime logs or environment here.
- I cannot see whether the deployed Worker has the expected Supabase bindings/environment at runtime.
- I cannot reproduce the exact production 503 from the local build, because the local build uses the generated local config and local bindings, not the live production environment.

So the conclusion is evidence-based but not exhaustive: the symptom is a platform/Worker-level failure signature, not a single application route bug, and the intermittent nature suggests environment/runtime instability in production.

## 2. Minimum fixes needed

For the MVP launch, the minimum fixes are:

1. Stabilize the deployed production Worker environment.
   - Confirm the deployed Worker has the expected environment and bindings it needs at runtime.
   - Confirm Supabase connectivity from the deployed Worker when it is supposed to be configured.
   - Confirm whether the `error code: 1102` body is coming from the platform dispatch layer or from a runtime error in the deployed Worker.

2. Decide the production Supabase configuration posture.
   - The app is built so that:
     - without Supabase configured, it uses a bundled seed catalogue locally
     - with Supabase configured, catalogue-backed pages fail visibly instead of serving stale seed data
   - For launch, you must decide whether the deployed production Worker is intended to run with real Supabase connectivity or without it. The current production behavior is not consistently healthy in either case.

3. Do not treat transactional email as a launch blocker for guest checkout.
   - Guest checkout and order creation do not require email sending to function.
   - Order confirmation email is a follow-up concern, not a storefront launch blocker.
   - The code already fails email cleanly when it is not configured, so missing email config does not break checkout itself.

4. Do not enable customer registration for the MVP.
   - Keep customer registration disabled as intended.
   - Guest checkout remains the supported path.

5. Do not broaden scope for launch.
   - Skip Email Center, CRM, and any nonessential admin features for now.

## 3. Whether the fixes can be applied without migrations

Yes, the launch stabilization fixes can be applied without migrations:

- Stabilizing the deployed Worker environment and environment/binding configuration is not a migration.
- Configuring production Supabase connectivity, if that is the intended posture, is an environment/secret configuration matter, not a schema migration.
- Removing transactional email as a launch blocker is a launch-scope decision, not a migration.
- The existing production database already contains the catalogue and order tables the app uses. No schema change is required to launch the storefront and guest checkout.

What I will not do without explicit approval:

- I will not run migrations 0005/0006/0007.
- I will not modify production database data.
- I will not change production billing or create services.
- I will not change production secrets or environment values directly here.

## 4. Expected customer-visible improvements after stabilization

Once the production Worker is stable and the intended Supabase/environment posture is correctly configured, customers should see:

- Homepage, shop, product pages, cart, checkout, wishlist, compare, account, and sign-in pages responding normally instead of intermittently failing.
- Guest checkout usable for order creation.
- Order lookup working for existing stored orders, including the existing order page that renders order items, delivery, payment, and total.
- Admin login reachable and admin order/product list pages usable after sign-in, instead of only redirecting to login or intermittently failing.
- No more intermittent `error code: 1102` responses across unrelated routes.

This is the customer-visible outcome you want for a first stable launch: a working storefront, catalogue, guest checkout, order lookup, and admin login.

## 5. Final deployment readiness verdict

NOT READY TO DEPLOY

Reason:

- Local checks are good: typecheck passes, production build passes, the Worker bundle builds, local Wrangler smoke tests pass for the storefront, product page, cart, checkout, account, admin login, order page, and order API validation.
- Production readiness is not yet confirmed because the live production Worker is intermittently returning `error code: 1102` 503s across many unrelated routes.

In other words, the code and build are ready, but the production environment is not stable enough to ship yet.

Suggested next step before any deploy:

- Have someone with access to the Cloudflare Worker deployment diagnostics check why the live Worker is intermittently returning `error code: 1102`.
- Confirm the deployed Worker’s runtime environment and Supabase connectivity posture.
- Then decide whether to stabilize production first, deploy the current build to a fresh environment, or both.

I am stopping here and waiting for your explicit approval before any deploy, migration, production write, secret change, billing change, or Git operation.
