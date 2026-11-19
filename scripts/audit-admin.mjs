#!/usr/bin/env node
/**
 * Read-only AB Tech admin audit.
 *
 * This is a focused test for the admin surface, not a data fixture: it signs in
 * with the credentials in `.env.local` (never printed), then exercises pages and
 * the validation/authorization paths of the newer APIs. It performs NO writes —
 * every mutation it sends is deliberately invalid, so it must be rejected before
 * touching a row.
 *
 * Usage:
 *   node scripts/audit-admin.mjs
 *   AUDIT_BASE_URL=https://racine-it.abbilalys.workers.dev node scripts/audit-admin.mjs
 *
 * Exit code is 1 when any check fails, so it can gate a release.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = (process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, value] = match;
      if (!(key in env)) env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local: rely on the process environment */
  }
  return env;
}

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const ADMIN_PAGES = [
  ["/admin", "Dashboard"],
  ["/admin/products", "Products"],
  ["/admin/orders", "Orders"],
  ["/admin/customers", "Customers"],
  ["/admin/categories", "Categories"],
  ["/admin/brands", "Brands"],
  ["/admin/inventory", "Inventory"],
  ["/admin/banners", "Homepage banners"],
  ["/admin/settings", "Store settings"],
  ["/admin/reports", "Reports"],
  ["/admin/products/import", "Import"],
  ["/admin/suppliers", "Suppliers"],
  ["/admin/quotations", "Quotations"]
];

async function main() {
  const env = loadEnv();
  const email = env.ADMIN_EMAIL ?? "";
  const password = env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.error("ADMIN_EMAIL / ADMIN_PASSWORD are not available. Cannot audit.");
    process.exit(2);
  }

  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual"
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  record("Admin sign-in", login.status === 200 && cookie.includes("="), `HTTP ${login.status}`);
  if (login.status !== 200 || !cookie) {
    summary();
    return;
  }

  // 1. Every admin module renders for an authenticated administrator.
  for (const [path, label] of ADMIN_PAGES) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const failed =
      res.status !== 200 ||
      html.includes("Application error") ||
      html.includes("An error occurred in the Server Components") ||
      html.includes('name="password"');
    record(`${label} (${path})`, !failed, `HTTP ${res.status}`);
  }

  // 2. Email Center screens must be switched off while migration 0005 is absent.
  for (const path of ["/admin/followups", "/admin/emails", "/admin/templates", "/admin/campaigns", "/admin/webhooks"]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    const body = res.status === 200 ? await res.text() : "";
    const rawDbError = /Could not find the table|relation .* does not exist/i.test(body);
    // Either the explicit disabled screen is shown, or the feature is enabled
    // and the page works — never a raw database error either way.
    const guarded = !rawDbError && (body.includes("Email Center is not enabled") || res.status === 200);
    record(
      `Email Center guarded (${path})`,
      guarded,
      body.includes("Email Center is not enabled") ? "disabled screen" : `HTTP ${res.status}`
    );
  }

  // 3. A malformed record id must be a 404, not a database error page.
  const malformed = await fetch(`${BASE}/admin/orders/not-a-uuid`, {
    headers: { cookie },
    redirect: "manual"
  });
  const malformedBody = malformed.status === 200 ? await malformed.text() : "";
  const malformedIs404 =
    malformed.status === 404 ||
    malformedBody.includes("This page could not be found") ||
    malformedBody.includes("404");
  const malformedIsDbError = /invalid input syntax|22P02/i.test(malformedBody);
  record(
    "Malformed order id shows the 404 page",
    malformedIs404 && !malformedIsDbError,
    `HTTP ${malformed.status}${malformedIsDbError ? ", database error leaked" : ""}`
  );

  // 3. Authorization: the new endpoints reject anonymous callers.
  const anonymous = [
    ["GET", "/api/admin/customers/notes?email=a%40b.co"],
    ["POST", "/api/admin/customers/notes"],
    ["GET", "/api/admin/banners"],
    ["PATCH", "/api/admin/settings"]
  ];
  for (const [method, path] of anonymous) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : "{}",
      redirect: "manual"
    });
    record(`Anonymous ${method} ${path} is rejected`, res.status === 401, `HTTP ${res.status}`);
  }

  // 4. Authenticated reads work and return the expected shape.
  const banners = await fetch(`${BASE}/api/admin/banners`, { headers: { cookie } });
  const bannerBody = await banners.json().catch(() => null);
  record(
    "Banners API returns a banner list",
    banners.status === 200 && Array.isArray(bannerBody?.rows),
    `HTTP ${banners.status}, ${Array.isArray(bannerBody?.rows) ? bannerBody.rows.length : "?"} rows, responsive=${bannerBody?.responsive}`
  );

  const notes = await fetch(`${BASE}/api/admin/customers/notes?email=audit%40example.com`, {
    headers: { cookie }
  });
  const notesBody = await notes.json().catch(() => null);
  record(
    "Customer notes API returns a note list",
    notes.status === 200 && Array.isArray(notesBody?.notes),
    `HTTP ${notes.status}`
  );

  // 5. Validation rejects bad input without writing anything.
  const invalidNote = await fetch(`${BASE}/api/admin/customers/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ email: "audit@example.com", note: "" })
  });
  record("Empty customer note is rejected", invalidNote.status === 400, `HTTP ${invalidNote.status}`);

  const invalidBanner = await fetch(`${BASE}/api/admin/banners`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "Audit banner without an image" })
  });
  record("Banner without an image is rejected", invalidBanner.status === 400, `HTTP ${invalidBanner.status}`);

  const invalidCurrency = await fetch(`${BASE}/api/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      storeName: "AB Tech",
      currency: "XYZ",
      standardShipping: 0,
      expressShipping: 0
    })
  });
  record("Unknown currency is rejected", invalidCurrency.status === 400, `HTTP ${invalidCurrency.status}`);

  // 6. Checkout rejects a phone that cannot be dialled, before any write.
  const badPhone = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ slug: "audit-does-not-exist", qty: 1 }],
      customer: {
        firstName: "Audit",
        lastName: "Check",
        email: "audit@example.com",
        phone: "abc",
        address: "1 Test Street",
        city: "Casablanca",
        postal: "20000",
        country: "MA"
      },
      delivery: "standard",
      payment: "cod"
    })
  });
  const badPhoneBody = await badPhone.json().catch(() => ({}));
  record(
    "Checkout rejects an invalid phone number",
    badPhone.status === 400 && /phone/i.test(String(badPhoneBody.error ?? "")),
    `HTTP ${badPhone.status}: ${String(badPhoneBody.error ?? "").slice(0, 60)}`
  );

  // 7. Storefront routes the admin work depends on.
  for (const path of ["/", "/categories", "/shop"]) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    record(`Storefront ${path}`, res.status === 200, `HTTP ${res.status}`);
  }

  summary();
}

function summary() {
  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("Failures:");
    for (const failure of failed) console.log(`- ${failure.name} (${failure.detail})`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("Audit crashed:", error instanceof Error ? error.message : error);
  process.exit(2);
});
