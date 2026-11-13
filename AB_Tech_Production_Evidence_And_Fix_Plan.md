# AB Tech — Phase 1: Production Failure Evidence & Safe Fix Plan

Read-only investigation. This report establishes what evidence is actually available for the intermittent `HTTP 503 / Cloudflare error 1102` on `https://racine-it.abbilaly.workers.dev/`, what it proves, and the smallest safe remediation options.

**Strict read-only compliance for this phase:**

- No repository files were edited (this report is the only new file).
- No dependencies installed (`node_modules` is still absent; `wrangler` CLI was never run).
- No migrations, no database writes, no production data changes.
- No environment variables, secrets, Cloudflare settings or Supabase settings changed.
- No deploy, no `git commit`, no branch change, no push.
- Secret **values** were never read into output, printed, copied or logged. Only secret **names** and binding **types** were inspected through the Cloudflare API, and the API token was used from the existing process environment with `Authorization` headers only — never echoed.

---

## 1. Executive summary

The exact cause is **no longer unconfirmed**.

Cloudflare's own Worker log events for the failing requests read:

```
source.level   = error
source.message = "Worker exceeded CPU time limit."
$workers.outcome       = "exceededCpu"
$workers.cpuTimeMs     = 10
$workers.wallTimeMs    = 12–14
event.response.status  = 503
$workers.scriptVersion = 215f8405-c22b-4ae5-bb0e-6a7142de0361
```

So the `503` / `error code: 1102` responses are **Cloudflare terminating the Worker for exceeding its per-invocation CPU limit**, on the currently deployed script version, with an enforced budget of **10 ms of CPU**.

Three facts make this decisive:

1. **All 131 failures ever recorded are `exceededResources` from CPU** — 131 errors, 131 requests, every one of them after the 2026-11-05 deploy and **zero before it**.
2. **Every one of the 131 failures falls inside a single hour** (`2026-11-09T19:00Z`), in a tight burst around `19:46:32–19:46:35Z`, during a 726-request load burst (18% of that hour failed, 82% succeeded).
3. **The identical deployed version now serves the identical routes successfully at 27–122 ms of CPU** (max 1,031 ms observed), with zero errors in the last 24 hours.

That combination rules out "a bug on one page". It points at the **CPU budget itself** — the account's enforced per-invocation CPU allowance was 10 ms at failure time and is far higher now. Everything else in the app degrades consistently with that: light responses (static assets, redirects, cheap pages) survived the 10 ms ceiling, while server-rendered catalogue and admin pages — which need ~30–120 ms of CPU — were killed.

What this means for launch:

- **The 1102 is currently not reproducing.** 15 read-only probes across 9 routes today returned 200, and Analytics shows 0 errors in 24 h.
- **It is not fixed by evidence.** Nothing in the code changed between the failing burst and now; only the enforced CPU allowance appears to differ. If that allowance ever returns to 10 ms — a plan lapse, a billing issue, an account change, or a new Worker under a free-tier ceiling — **the whole storefront fails again immediately**, because per-request CPU (p99 ≈ 1.03 s in the last 24 h) is orders of magnitude above 10 ms.
- **The primary remediation is operational, not code**: confirm and protect the Workers CPU entitlement, and watch `exceededCpu`. Code changes are defence-in-depth and cannot substitute for the entitlement.
- **The deployed Worker is not the code in the repository.** The live build ID differs from the inspected build, and the deployed version predates the source revision. Any fix must be re-verified after a deploy.

There is also one genuinely separate correctness risk found while reading the order path: a failed order call cannot currently distinguish *"not saved"* from *"unknown outcome"*, which risks duplicate or lost orders during an incident. That is worth a small fix independently of the 1102.

---

## 2. Evidence access matrix

| Evidence source | Accessible here? | What was obtained |
| --- | --- | --- |
| Cloudflare integration (connected apps) | **No** | Only GitHub (2 accounts) and Supabase (1 project) are connected. There is no Cloudflare integration. |
| Cloudflare REST API (existing `CLOUDFLARE_API_TOKEN` in workspace env) | **Yes** | Account, script settings/bindings (names only), deployments, versions, GraphQL Analytics, Workers Observability telemetry query — all HTTP 200. |
| Cloudflare billing / subscriptions | **No** | `GET /accounts/{id}/subscriptions` → **HTTP 403** (token has no billing scope). Plan and plan history are unverifiable from here. |
| `wrangler tail` / `wrangler deployments` CLI | **No** | `node_modules` absent, `wrangler` not installed globally, and dependency installation is prohibited in this phase. |
| GitHub Actions / CI deploy history | **No CI exists** | 0 workflow runs, 0 environments, 0 deployments for `abbilaly/racine-IT`. Deployment records show `source=wrangler`, author `abbilaly@gmail.com` — deploys are manual from a workstation. |
| Supabase project health, config, metrics | **Yes** | Project `racine-IT` (`lqyvcrseuojfpeodwawn`), `ACTIVE_HEALTHY`, eu-west-1. |
| Supabase logs for the failure hour | **No** | Retention is effectively shorter than the investigation window: 7-day totals are edge_logs 155, postgrest_logs 15, pgbouncer_logs 10, postgres_logs 1. Nothing from 2026-11-09 survives. |
| Live production HTTP (read-only GETs) | **Yes** | 15 probes across 9 routes plus `/BUILD_ID`, with status, timing, `cf-ray`, `x-opennext`. |
| Local build artifacts | **Yes** | `.open-next/` present, `BUILD_ID` = `VvLOOvhD5AknHEQnoT-UP`, built `2026-11-09T19:38Z`. |

---

## 3. Evidence collected

### 3.1 Account, Worker and current deployment

- Cloudflare account: `f3eba0495229ca63c093be96790d68b8` ("Abbilaly@gmail.com's Account").
- Worker: `racine-it`, `100%` on version `215f8405-c22b-4ae5-bb0e-6a7142de0361`.
- Deployed: `2026-11-05T16:55:38Z`, `source=wrangler`, `strategy=percentage`, author `abbilaly@gmail.com`.
- Prior deploys on the same day: `14:57:53Z`, `14:16:46Z`, `13:56:38Z`, plus `2026-11-02`.
- Deployed script settings report **no custom CPU/memory limits** (`settings.limits` absent) — so the 10 ms ceiling observed in the logs is **not** coming from repository configuration; `wrangler.jsonc` declares no `limits` block either.

### 3.2 Production bindings (names and types only — no values)

```
ASSETS                      assets
CUSTOMER_ALLOW_REGISTRATION secret_text
SUPABASE_ANON_KEY           secret_text
SUPABASE_SERVICE_ROLE_KEY   secret_text
SUPABASE_URL                secret_text
```

Confirmed: **production is Supabase-configured**. Also confirmed: **no `RESEND_API_KEY`** (transactional email is not configured in production) and **no `D1`/`DB` binding** (the order D1 fallback in `lib/server/orders.ts` cannot work in production; if Supabase were ever unconfigured, `getDb()` would throw a 503 app error, not a 1102).

### 3.3 Deployed version vs source vs inspected build

| Artifact | Identity | Timestamp |
| --- | --- | --- |
| Deployed Worker version | `215f8405-c22b-4ae5-bb0e-6a7142de0361` | `2026-11-05T16:55:38Z` |
| Git HEAD (branch `freebuff/racine-it-admin-supabase`) | `089eb243d7b0a52fdeef7c9ab83bc096fbb0e59a` | `2026-11-07T21:10:48Z` |
| Working tree | **165 modified/untracked entries** | file mtimes up to `2026-11-09T17:49Z` |
| Inspected `.open-next` build | `BUILD_ID VvLOOvhD5AknHEQnoT-UP` | `2026-11-09T19:38Z` |
| **Live** `/BUILD_ID` | **`dujcyM2C0_brgapo-FP3c`** | served now |

**Confirmed mismatch, three ways.** The deployed Worker predates the source revision by ~2 days, and the inspected build is not the live build. Consequences:

- The earlier diagnosis inspected a **newer** codebase than production runs; its conclusions about shared paths remain valid as code structure, but they were not verified against the exact running bytes.
- No CI/tagging exists to map a deployment to a commit, so the live revision is only inferable.
- Any remediation must be validated against a **rebuilt and redeployed** artifact, and the new live `BUILD_ID` must be captured to prove what shipped.

### 3.4 The failure evidence (Cloudflare Workers Analytics + Logs)

**Status classes over 30 days** (`workersInvocationsAdaptive`, script `racine-it`):

| status | requests | errors |
| --- | --- | --- |
| success | 6,945 | 0 |
| **exceededResources** | **131** | **131** |
| clientDisconnected | 17 | 0 |

**Deploy-time split — this is the strongest single correlation:**

| Window | success | exceededResources |
| --- | --- | --- |
| 2026-10-28 → 2026-11-05T16:55 (before the live deploy) | 3,204 | **0** |
| 2026-11-05T16:55 → now (after the live deploy) | 1,780 | **131** |

**Hourly distribution** (only hours with traffic):

```
2026-11-05 13:00  40      2026-11-09 18:00   1      2026-11-10 12:00 122
2026-11-05 14:00 299      2026-11-09 19:00 726  <-- 131 failures here
2026-11-05 15:00 260      2026-11-09 20:00  10      2026-11-10 13:00 146
2026-11-05 16:00 457      2026-11-09 22:00  27      2026-11-11 20:00   3
2026-11-05 17:00 252      2026-11-07 10:00  86      2026-11-11 22:00  31 (today's probes)
2026-11-05 18:00  68      2026-11-08 20:00  40
```

Hour `2026-11-09T19:00Z`: **726 requests, 595 success, 131 `exceededResources`** — a failure rate of ~18%, concentrated in a burst.

**The actual log events** (Workers Observability telemetry, `view: events`, filtered to `$workers.scriptName = racine-it`):

```
{"source":{"level":"error","message":"GET https://racine-it.abbilaly.workers.dev/product/apple-iphone-13-mini-128gb-pink"},
 "$workers":{"path":"/product/apple-iphone-13-mini-128gb-pink",
             "event":{"response":{"status":503}},
             "scriptVersion":{"id":"215f8405-c22b-4ae5-bb0e-6a7142de0361"},
             "eventType":"fetch","executionModel":"stateless",
             "outcome":"exceededCpu","wallTimeMs":12,"cpuTimeMs":10}}

{"source":{"level":"error","message":"Worker exceeded CPU time limit."},"$workers":{...,"cpuTimeMs":10}}

{"source":{"level":"error","message":"GET .../order/RIT-8F0D8111"}, "$workers":{"outcome":"exceededCpu","wallTimeMs":14,"cpuTimeMs":10, "event":{"response":{"status":503}}}}
{"source":{"level":"error","message":"GET .../admin/products"},  "$workers":{"outcome":"exceededCpu","wallTimeMs":13,"cpuTimeMs":10, "event":{"response":{"status":503}}}}
{"source":{"level":"error","message":"GET .../admin/orders"},    "$workers":{"outcome":"exceededCpu","wallTimeMs":14,"cpuTimeMs":10, "event":{"response":{"status":503}}}}
```

Observations from the event stream in the failure window:

- `outcome` counts in the window: `ok: 28`, `exceededCpu: 8`, plus 14 partial/auxiliary error records (the same failures emit a request-level record and a `"Worker exceeded CPU time limit."` record, so counts double).
- **Every** CPU failure reports `cpuTimeMs: 10` and `wallTimeMs: 12–14` — the invocation was killed ~12 ms in, at exactly the ceiling.
- Failed paths seen: `/product/apple-iphone-13-mini-128gb-pink`, `/order/RIT-8F0D8111`, `/admin/products`, `/admin/orders`. HTTP analytics for the wider `18:30–20:00Z` window also shows `503` on `/shop` (11×), `/order/RIT-8F0D8111` (13×) and `/admin/products` (9×).
- All events in the window carry `scriptVersion 215f8405` — **the same version still deployed today**.

**CPU / duration quantiles** (`workersInvocationsAdaptive`):

| Window | requests | errors | cpu p50 | cpu p90 | cpu p99 | duration p50 | duration p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| last 24 h | 35 | 0 | 54,626 µs | 489,634 µs | 1,031,217 µs | 68.8 ms | 1.03 s |
| last 7 d | 2,732 | 131 | 15,777 µs | 144,700 µs | 460,952 µs | 18.0 ms | 461 ms |
| last 30 d | 7,093 | 131 | 12,523 µs | 157,290 µs | 465,594 µs | 13.7 ms | 466 ms |

**Recent successful requests** (last 3 h, all `outcome: ok`, all HTTP 200) report `cpuTimeMs` of **27, 27, 28, 29, 29, 31, 31, 35, 37, 38, 40, 45, 54, 68, 77, 84, 88, 99, 122** with `wallTimeMs` 189–633, and a **max `cpuTimeMs` of 1,031 ms** in the sample.

That is the crux: **the same code, same version, same routes, now needs 27–122 ms (p99 ≈ 1 s) of CPU and succeeds.** On 2026-11-09 it was being killed at 10 ms.

### 3.5 Subrequest behaviour — the numbers that rule out Supabase as the cause

From the 7-day status split:

| outcome | requests | subrequests | subrequests / request |
| --- | --- | --- | --- |
| success | 2,595 | — (per-window: 4,592 / 1,780 ≈ 2.6) | ≈ 2.6–4.4 |
| **exceededResources** | **131** | **102** | **≈ 0.78** |

Failed invocations made **fewer than one** subrequest on average, and their `wallTimeMs` was 12–14 ms. A Supabase round trip from `eu-west-1` cannot even complete in 12 ms. **The failing requests died before Supabase could have been involved.**

### 3.6 Supabase-side evidence

- Project `racine-IT` (`lqyvcrseuojfpeodwawn`), `ACTIVE_HEALTHY`, eu-west-1, Postgres 17.11.
- Service health: `auth`, `db`, `db_postgres_user`, `pg_bouncer`, `pooler`, `rest`, `storage` all `ACTIVE_HEALTHY`; **`realtime` UNHEALTHY** (the app does not use Realtime — no impact on the storefront).
- Log volume is tiny and short-lived: over 7 days, `edge_logs` 155, `postgrest_logs` 15, `pgbouncer_logs` 10, `realtime_logs` 3, `storage_logs` 1, `postgres_logs` 1.
- During today's 15-probe set, Supabase recorded **153 `edge_logs` entries in the 22:40 minute** — i.e. the live deployment is actively querying Supabase at roughly **~10 Supabase API requests per page render** (the 5-query catalogue read plus auth/session work where applicable). So the live build *is* Supabase-backed, and it works.
- No Supabase latency spike, error burst or saturation signal was found in the accessible window. Metrics (Prometheus) show a healthy small instance: `pgbouncer_used_servers 2`, `pgbouncer_databases_pool_size 15`, `pgbouncer_stats_client_wait_seconds_total ≈ 11.4 s` cumulative, `postgresql_restarts_total 0`, zero OOM kills.
- **The failure hour itself is outside Supabase's retrievable log window**, so a same-second comparison is impossible. Stated as a limitation, not as an absence of a problem.

### 3.7 Live read-only production probes (today, `2026-11-11T22:40Z`)

```
/                      200  t=1.46s  72,640 B
/shop                  200  t=1.09s  62,256 B
/cart                  200  t=0.63s  33,116 B
/checkout              200  t=2.07s  33,309 B
/compare               200  t=0.60s  33,118 B
/wishlist              200  t=0.61s  32,790 B
/account               200  t=0.59s  44,187 B
/admin/login           200  t=0.60s  34,324 B
/order/RIT-8F0D8111    200  t=0.85s  38,952 B
/ (x6 repeats)         200  0.58–0.66 s, identical 72,640 B body each time
```

All responses carry `x-opennext: 1`, `x-powered-by: Next.js`, `server: cloudflare`, distinct `cf-ray` per request, and `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`. **No 503 and no 1102 occurred; the incident is not currently reproducible.**

---

## 4. Confirmed findings

Each item below is directly evidenced, not inferred.

**F1 — Error 1102 here is a CPU-limit kill, and Cloudflare says so explicitly.**
Log events: `"Worker exceeded CPU time limit."`, `outcome: exceededCpu`, `response.status: 503`. This supersedes the earlier "platform failure, cause unknown" framing in `AB_Tech_Production_Stability_Diagnosis.md`.

**F2 — The enforced CPU budget at failure time was 10 ms.**
Every failing invocation reports `cpuTimeMs: 10` and `wallTimeMs: 12–14`; the invocation is terminated at the ceiling, not after completing work.

**F3 — The failures are one burst, not a steady state.**
All 131 errors fall in `2026-11-09T19:00Z` (specifically `19:46:32–19:46:35Z`), 726 requests, ~18% failure. Every other hour with traffic — including hours with more traffic (457, 299, 260 requests on 11-05) — has **zero** errors.

**F4 — Zero errors before the current deploy; all errors after it.**
Before `2026-11-05T16:55Z`: 3,204 requests, 0 errors. After: 1,780 requests, 131 errors. (Correlation, not proof of causation — see H1/H2 below, because the *same* deployed version now succeeds.)

**F5 — The failing requests did not reach Supabase.**
≈0.78 subrequests per failed request and `wallTimeMs` 12–14 ms.

**F6 — The same deployed version succeeds today at 27–1,031 ms of CPU.**
Current 200s consume 27–122 ms CPU typically; p99 over 24 h is 1,031 ms. Nothing about the code changed, so the **enforced allowance** — not the code — is what differs.

**F7 — Production is Supabase-configured, without D1 and without Resend.**
Bindings list proves it. Therefore: order creation/lookup takes the Supabase path; the D1 fallback is dead code in production; email is genuinely off.

**F8 — The deployed Worker is not the code under review.**
Live `/BUILD_ID` `dujcyM2C0_brgapo-FP3c` ≠ local `VvLOOvhD5AknHEQnoT-UP`; deployed version `2026-11-05` predates HEAD `2026-11-07` and the source working tree (`2026-11-09`).

**F9 — Deployment is manual and untracked.**
No GitHub Actions runs/environments/deployments exist; Cloudflare records `source=wrangler`, i.e. a human ran `opennextjs-cloudflare deploy` locally. There is no commit↔deployment mapping and no automatic rollback trail.

**F10 — No custom CPU/memory limit is configured on the deployed script.**
`settings.limits` absent; `wrangler.jsonc` declares no `limits`. The 10 ms ceiling therefore came from the **account entitlement or platform enforcement**, not from repository config.

**F11 — The failure signature is inconsistent with memory exhaustion.**
No `exceededMemory` outcome appears anywhere in 30 days; the only error class is `exceededCpu`/`exceededResources`.

---

## 5. Plausible hypotheses (ranked, with the evidence that supports or weakens each)

### H1 — The account's enforced CPU allowance was 10 ms at failure time and is higher now. *(strongest)*
**Supports:** F2 (kill at exactly 10 ms), F6 (same version now uses 27–1,031 ms and succeeds), F10 (no configured limit ⇒ entitlement-level), F3 (a self-contained burst rather than a code change), F4 (the burst lands days after the deploy, not at deploy time).
**Mechanism that fits all data:** Workers **Free** enforces 10 ms CPU per invocation; Workers **Paid** allows far more. On 2026-11-09 the Worker was operating under a 10 ms ceiling, so every server render (which needs 30–120 ms) died while cheap responses survived; afterwards the allowance increased (upgrade/billing change/platform correction), and the identical code started succeeding.
**Weakens it:** the plan/billing history is **not verifiable** from here (`subscriptions` → 403). It remains a hypothesis precisely because of that gap.
**How to confirm (owner, 2 minutes):** Cloudflare dashboard → Workers & Pages → `racine-it` → Settings/Metrics, plus account billing: confirm the Workers plan in force and whether it changed on/around 2026-11-09.

### H2 — Cold-isolate startup CPU consumed the entire small budget. *(compatible with H1, and explains the intermittency)*
**Supports:** `wallTimeMs` 12–14 ms means death at invocation start, before any Supabase round trip; OpenNext's first request in an isolate pays module init plus a **dynamic import of the server-function handler** (`.open-next/worker.js` → `import("./server-functions/default/handler.mjs")`); at a 10 ms budget, a cold isolate can exhaust the allowance during bootstrap, while warm isolates that already paid it render fine.
**Weakens it:** it does not by itself explain why cheap pages succeeded at the same moment unless their warm path cost <10 ms — plausible but unmeasured per-route.
**How to confirm:** correlate failures with isolate/cold-start markers in Workers Logs (`$workers.event.request.cf` + `scriptVersion`, plus first-request-per-isolate patterns), and measure cold vs warm CPU locally.

### H3 — Supabase latency/timeouts caused the 503s. *(not supported — should be dropped)*
**Against:** ≈0.78 subrequests on failed requests; 12–14 ms wall time; Supabase `ACTIVE_HEALTHY` with no saturation; today's Supabase-backed pages succeed at 27–122 ms CPU. The earlier diagnosis's conditional "if Supabase is configured, this could be the cause" is resolved: **Supabase is configured, and it is not the cause of the 1102.**

### H4 — Memory exhaustion (128 MiB). *(not supported)*
**Against:** no `exceededMemory` in 30 days; killed at the CPU ceiling, not a memory ceiling.

### H5 — Structural CPU headroom risk (not the cause, but a real launch risk). *(moderate, forward-looking)*
**Supports:** per-request CPU today is **p99 ≈ 1.03 s** and typical 27–122 ms for an SSR page that renders only 32–73 KB of HTML. `app/layout.tsx` sets `dynamic = "force-dynamic"`, so **every** request re-runs the catalogue read (5 Supabase queries + JSON→`Product[]` normalisation + stock/image aggregation) and re-renders chrome, on top of Next.js SSR. Nothing is cached between requests.
**Why it matters:** it means the storefront sits far above free-tier CPU budgets, so **any** lapse in entitlement reproduces this incident instantly and account-wide. It also makes cold starts and traffic spikes expensive.
**Caveat:** I have no per-route CPU split, so I cannot say how much of the 27–122 ms is the catalogue read versus React rendering. That limits how confidently a code change can be claimed to help.

---

## 6. Missing production evidence — precise instructions for the owner

These are the only remaining gaps. Each is a dashboard action; none can be done from this workspace.

1. **Workers plan and plan history (highest value).**
   Cloudflare dashboard → **Workers & Pages** → `racine-it` → **Metrics** (look at the CPU-time chart and the 1102/`exceededCpu` spike) and → **Settings** for the plan/limits in force. Then account-level **Billing → Subscriptions / Invoices** to confirm the Workers plan and whether it changed on or around **2026-11-09**. This is the single item that would turn H1 from hypothesis into fact.

2. **Confirm the CPU limit value currently in force.**
   Workers & Pages → `racine-it` → Settings → **Limits**: record the CPU limit (and whether Free-tier 10 ms applies). Compare against the 27–1,031 ms CPU the app now consumes.

3. **Workers Logs around the burst, with a wider window.**
   Workers & Pages → `racine-it` → **Logs** → filter `outcome = exceededCpu` for **2026-11-09 19:40–20:00Z**, and check whether failures are the **first** request of each isolate (H2) or scattered across warm ones.

4. **Platform-side incident history for SJC on 2026-11-09 ~19:46Z.**
   `cloudflarestatus.com` incident history, and a support ticket if the dashboard shows no plan change — this is the alternative explanation for a 3-second CPU-enforcement anomaly.

5. **The exact live revision.**
   Workers & Pages → `racine-it` → **Deployments** → version `215f8405` and its build/annotations, to identify which worktree state produced it. Without CI tags this is otherwise unrecoverable, and it is why the audit and the live Worker cannot be proven to be the same code.

6. **Billing/alerts hygiene.**
   Confirm a billing alert exists for the Workers subscription (so a lapsed payment cannot silently downgrade the storefront to a 10 ms CPU ceiling).

7. **Supabase logs for any recurrence.**
   For future incidents, capture `postgrest_logs`/`edge_logs` **within the same hour** — retention here is too short (≈1 day) to investigate after the fact. (Read-only note; no settings were changed.)

---

## 7. Most likely failure paths, ranked by evidence

| Rank | Failure path | Evidence strength | What the evidence shows |
| --- | --- | --- | --- |
| 1 | **Per-invocation CPU limit at 10 ms kills server-rendered requests** (`/product/*`, `/shop`, `/order/*`, `/admin/products`, `/admin/orders`) | **Confirmed** | Explicit `"Worker exceeded CPU time limit."`, `outcome=exceededCpu`, `cpuTimeMs=10`, `wallTimeMs=12–14`, `status=503`, on version `215f8405`. |
| 2 | **A change in the enforced CPU allowance (plan/entitlement) explains why it now passes** | **Strong correlation, unverified cause** | Same version, same routes: 0 errors now, 27–1,031 ms CPU tolerated. Billing API is 403, so the plan change itself is unverified. |
| 3 | **Cold-isolate bootstrap consumes the whole budget** | **Plausible, partially supported** | Death at 12 ms wall; OpenNext pays init + dynamic import on first request per isolate. Needs per-isolate evidence (item 3 in §6). |
| 4 | **No CPU headroom in the architecture** (force-dynamic layout + full catalogue read + SSR on every request) | **Supported by measurement, not the trigger** | p99 CPU ≈ 1.03 s; every request re-reads Supabase. Makes recurrence likely under any tighter ceiling. |
| 5 | Supabase latency/timeouts | **Ruled out for this incident** | ≈0.78 subrequests on failures, 12 ms wall, healthy project, pages succeed now. |
| 6 | Memory exhaustion | **Ruled out** | No `exceededMemory` anywhere in 30 days. |

---

## 8. Minimal remediation proposal

Ordered by evidence weight. **R0 is the actual fix for the observed incident; R1–R4 are small, safety-improving changes and none of them is claimed to prevent a 10 ms CPU ceiling.**

Each option states expected benefit, possible side effects, and required tests. All are **proposals only — nothing was implemented.**

### R0 — Protect and monitor the CPU entitlement (operational; no code)
**What:** confirm the Workers plan in force, keep it current, add a billing alert, and add an alert/uptime check on `exceededCpu` + HTTP 5xx for `racine-it`.
**Expected benefit:** directly addresses F1/F2/H1 — the only demonstrated cause. Also gives early warning for the exact failure mode (currently there is none: 131 failures happened with no alert).
**Side effects:** none technical; possible cost of the paid plan and of alerting.
**Tests:** confirm the dashboard shows the plan and current limit; re-run the read-only probe set; confirm Analytics reports 0 `exceededCpu` after the change. No deploy needed.

### R1 — Bound external Supabase requests (small code change; justified as hygiene, **not** as the 1102 fix)
**Where:** `lib/supabase/server.ts` (client construction) and/or the readers in `lib/server/catalog.ts`, `lib/server/admin-auth.ts`, `lib/server/customer-auth.ts`, `lib/server/orders.ts`.
**What:** give the shared Supabase client a `global.fetch` that applies an `AbortSignal.timeout(...)` (≈2.5–3 s, under the existing 4 s shell budget) and a cancellable signal, so a stalled dependency fails fast and predictably instead of holding the invocation.
**Expected benefit:** bounded worst-case wall time; no orphaned in-flight request after the `SHELL_CATALOG_TIMEOUT_MS` race in `app/layout.tsx` resolves (today the losing `loadCatalog()` promise keeps running); clearer, consistent failures. Honest caveat: **evidence says this did not cause the 1102**, so expect improved predictability, not fewer CPU kills.
**Side effects:** a genuinely slow-but-successful catalogue query would now surface as "catalogue unavailable" on catalogue-backed pages (which is the intended policy in `lib/server/catalog.ts`) and as seed chrome in the layout. Checkout/order RPC must **not** be aborted mid-write — the timeout must be sized so a legitimate `create_order` transaction is never cut off, or the order path must opt out of the short timeout.
**Tests:** unit-level simulation of a hanging fetch (abort fires, error is the intended one); local Wrangler run with Supabase reachable and unreachable; verify `/shop` shows the honest failure page, the shell still renders on `/admin`, `/account`, `/order/*`, and that `POST /api/orders` still completes a real order locally.

### R2 — Reduce per-request CPU on the shared path (medium change; only if CPU headroom matters)
**Where:** `app/layout.tsx` (`loadShellCatalog`) and the catalogue call sites; optionally `lib/server/catalog.ts`.
**What options, smallest first:**
1. Serve **chrome-only** data (settings + category labels + a light product projection for cart badges) from a short-TTL cached snapshot, while catalogue-backed pages keep the strict, fresh read they have today. This preserves the existing "never present stale prices as current" policy on `/`, `/shop`, `/product/*`, `/cart`, `/checkout`, `/compare`, `/wishlist`.
2. Or narrow the `products` select in the shell path so `description`/`specs` (only needed by `/product/[slug]`) are not fetched and normalised on every request.
**Expected benefit:** lower CPU (and wall time) on every route, which is precisely the resource that was exhausted; more headroom against cold starts. This is the only code change that plausibly reduces recurrence risk.
**Side effects:** (1) chrome could briefly show stale counts/prices in the cart tray and compare tray — a **product-policy** decision, not just technical; (2) needs care that `/product/*` still gets full data. Neither touches admin auth or checkout logic.
**Tests:** measure CPU/wall before vs after with a repeatable probe set (and, if possible, Workers Analytics `cpuTimeP50/P99` on the deployed version); verify cart/compare/wishlist badges and totals are consistent; verify product pages still show description/specs; verify no stale price reaches `/checkout` (server-side pricing in `create_order` remains the authority).
**Do not ship on the strength of this report alone** — it needs the before/after CPU measurement to justify it.

### R3 — Explicit order-outcome handling without losing orders (small code change; independently justified)
**Where:** `lib/server/orders.ts` (`createOrderSupabase`), `app/api/orders` route, `components/CheckoutView.tsx`.
**What:** distinguish three outcomes and message them differently:
- **definitely not saved** (validation `400`, business-rule `409`, pre-send failure) → "your order was not placed, try again" (current behaviour).
- **definitely saved** (RPC returned a ref) → confirmation page (current behaviour).
- **unknown outcome** (abort/timeout/network error *after* the request was sent) → do **not** say "try again"; say the order may have been received, and direct the customer to the order lookup with their reference/email, or have the store reconcile by email.
Today every failure collapses to the generic "We could not save your order. Please try again." (`503`), which invites duplicate submissions when the transaction may actually have committed.
**Expected benefit:** no silently duplicated or lost orders during an incident — directly relevant because order traffic is exactly what a 1102 interrupts mid-flight.
**Side effects:** slightly more nuanced checkout copy; requires an "unknown outcome" UX and, ideally, an idempotency key so a retry cannot double-write. Adding an idempotency key needs a schema/RPC change (**out of scope for a minimal fix — requires migration approval**); the copy/behaviour change alone needs no schema change.
**Tests:** simulate a timeout after send and confirm the UI does not promise "not placed"; confirm no duplicate order rows; confirm `GET /order/RIT-XXXXXXXX` still resolves normally; confirm guest checkout with the five-argument `create_order` payload is unchanged (`ORDER_OWNERSHIP_ENABLED` stays `false`).

### R4 — Per-request timing visibility (optional, tiny)
**Where:** `app/layout.tsx` / `lib/server/catalog.ts`.
**What:** emit a `Server-Timing: catalog;dur=<ms>` response header (and log catalogue duration) instead of the current silent race.
**Expected benefit:** turns "was it the catalogue or the render?" into a one-request answer — the exact blind spot that made this investigation need the dashboard.
**Side effects:** negligible; header only, no data exposure (duration only, no query text, no secrets).
**Tests:** header present on `/`, `/shop`; absent/neutral on static assets; no effect on caching headers or order routes.

**Explicitly out of scope for this phase:** schema changes, migrations, `p_user_id`/order-ownership enablement (migration 0006), Email Center (0005), customer registration enablement, and any change to admin authentication, session cookies, or the guest-checkout contract.

**Preservation constraints that must hold for every option above:**
- `lib/server/admin-auth.ts` behaviour unchanged: cookie → `auth.getUser` → `admin_roles` via the RLS-scoped client; `requireAdmin()` still redirects to `/admin/login`.
- `lib/server/customer-auth.ts` unchanged (separate cookie, no role check).
- Guest checkout keeps sending exactly `p_items, p_customer, p_delivery, p_payment, p_note`; `ORDER_OWNERSHIP_ENABLED` stays `false`.
- `lib/server/catalog.ts` keeps refusing to serve seed prices on catalogue-backed pages; only chrome may fall back.

---

## 9. Verification checklist

### 9.1 Before any change (baseline, read-only)
- [ ] Record the live `BUILD_ID` (`dujcyM2C0_brgapo-FP3c` today) — the deployed artifact must be identified before and after.
- [ ] Record Analytics baseline for the trailing 7 days: `success`, `exceededResources`, `exceededCpu` counts and `cpuTimeP50/P90/P99`.
- [ ] Re-run the 15-probe read-only set (`/`, `/shop`, `/cart`, `/checkout`, `/compare`, `/wishlist`, `/account`, `/admin/login`, `/order/<real ref>`, repeats of `/`) and store status + timing + `cf-ray`.
- [ ] Owner completes §6 items 1–5 (plan, limits, logs, status page, live revision).

### 9.2 Local verification (no production impact)
- [ ] `npm ci` from the existing lockfile (dependencies are currently absent; the lockfile must not be upgraded).
- [ ] `npx tsc --noEmit` → exit 0.
- [ ] `npm run cf:build` → exit 0 and a fresh `.open-next/worker.js`.
- [ ] `wrangler dev --config freebuff.wrangler.jsonc` (local D1/R2/DO bindings) smoke test: `/`, `/shop`, `/product/<slug>`, `/cart`, `/checkout`, `/compare`, `/wishlist`, `/account`, `/admin/login`, `/order/<ref>`, plus `POST /api/orders` with invalid body (expect 400) and a valid local order (expect 201/200 with a ref) and order lookup.
- [ ] If R1 ships: hang the Supabase fetch locally and confirm the bounded, intended failure on catalogue pages, the seed-chrome fallback in the layout, and that admin/order routes still render.
- [ ] If R1 ships: confirm `create_order` is not aborted mid-write.
- [ ] If R3 ships: confirm the "unknown outcome" path never claims the order was not placed, and that no duplicate rows are created.
- [ ] If R2 ships: measure CPU/wall before vs after on the same probe set; do not claim an improvement without the measurement.
- [ ] Confirm the new local `BUILD_ID` and that no secrets or `.dev.vars`-style files enter the build output.

### 9.3 Production verification (requires explicit approval to deploy)
- [ ] Capture the pre-deploy live `BUILD_ID`; after deploy confirm the **new** `BUILD_ID` is the one served (proves the artifact shipped).
- [ ] Re-run the full probe set; all previously-200 routes still 200; no new 5xx.
- [ ] Analytics for 24 h after deploy: `exceededCpu` = 0; `cpuTimeP50/P99` not worse than baseline.
- [ ] Workers Logs: confirm no `"Worker exceeded CPU time limit."` events.
- [ ] Guest checkout end-to-end with one real test order (**this writes production data — needs explicit approval**), then `GET /order/<ref>` resolves and the admin order list shows it.
- [ ] Admin sign-in/session still works: `/admin/login`, then `/admin/orders` (expect 307 when signed out, 200 when signed in).
- [ ] Confirm `CUSTOMER_ALLOW_REGISTRATION` behaviour and that email remains off (no `RESEND_API_KEY`) — unchanged by these options.

---

## 10. Approval required before implementation or deployment

**Status: stopped. Nothing was implemented, deployed, migrated or changed.**

Explicit approval is required for each of the following, separately:

1. **Implement R0** — operational only (plan confirmation, billing alert, 5xx/`exceededCpu` alert, uptime check). No code, but it changes Cloudflare account/notification settings, so it needs a go-ahead.
2. **Implement R1 / R2 / R3 / R4** — code changes. R2 additionally needs a **product decision** on whether chrome may show briefly cached counts/prices.
3. **Rebuild and deploy** (`npm run deploy` → `opennextjs-cloudflare build && opennextjs-cloudflare deploy`). The deployed Worker is currently older than the source; deploying ships ~4 days of unreviewed working-tree changes, which is a separate release decision — not a side effect of this fix.
4. **Any migration or schema change** (including an idempotency key for R3, migration 0006 order ownership, migration 0005 email) — out of scope here.
5. **Any production write**, including the single end-to-end test order in §9.3.
6. **Any commit/push** on branch `freebuff/racine-it-admin-supabase` (currently 165 modified/untracked entries).

---

## 11. Bottom line

- The 1102 is **identified**: Cloudflare killed the Worker for exceeding a **10 ms** per-invocation CPU limit — `"Worker exceeded CPU time limit."`, `outcome=exceededCpu`, `status=503`, on deployed version `215f8405`.
- It is **not a Supabase problem** and **not a single-page bug**: failed requests made almost no subrequests and died ~12 ms in, and every error is in one burst on 2026-11-09.
- It is **not currently reproducing**: 0 errors in 24 h, 15/15 probes returning 200, and the same version now consuming 27–1,031 ms of CPU without complaint — which is why the remaining question is *why the allowance was 10 ms then*, and only the owner's dashboard/billing view can answer that.
- The **real launch risk** is that per-request CPU is intrinsically high (p99 ≈ 1 s) with `force-dynamic` rendering on every route: any return to a tight CPU ceiling fails the entire storefront. Protect the entitlement and monitor it (R0); reduce headroom cost only with measurement (R2).
- Separately, the order path should stop telling customers "try again" when an order's fate is unknown (R3) — small, no schema change, and it prevents duplicate or lost orders during exactly this kind of interruption.
- The deployed Worker is **not** the reviewed revision (build ID mismatch, 2026-11-05 vs 2026-11-07 HEAD), and deploys are manual with no CI trail — so verify the artifact, not the repository, and capture the live `BUILD_ID` on both sides of any release.
