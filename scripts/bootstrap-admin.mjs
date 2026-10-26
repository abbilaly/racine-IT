#!/usr/bin/env node
/**
 * Creates (or re-grants) the first Racine IT administrator.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_EMAIL=owner@example.com \
 *   ADMIN_PASSWORD='a long unique password' \
 *   node scripts/bootstrap-admin.mjs
 *
 * There is no default password anywhere in this repository: both values must
 * be supplied by the operator, and weak passwords are refused. The script
 * uses the service-role key on the command line only — never in source code.
 */
import { createClient } from "@supabase/supabase-js";

const WEAK = new Set([
  "password", "password123", "admin123", "racineit", "changeme",
  "letmein", "1234567890", "administrator"
]);

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const url = (process.env.SUPABASE_URL ?? "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!url || !serviceKey) {
  fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Project Settings → API).");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("Set ADMIN_EMAIL to the administrator's email address.");
}
if (password.length < 12) {
  fail("ADMIN_PASSWORD must be at least 12 characters. Pick a unique passphrase — nothing is defaulted for you.");
}
if (WEAK.has(password.toLowerCase())) {
  fail("ADMIN_PASSWORD is too easy to guess. Choose a different passphrase.");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

let userId = null;

const created = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

if (created.error) {
  if (!/already (registered|exists)/i.test(created.error.message)) {
    fail(`Could not create the user: ${created.error.message}`);
  }
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = (list.data?.users ?? []).find(user => user.email?.toLowerCase() === email);
  if (!existing) fail(`Could not find the existing user ${email}: ${list.error?.message ?? ""}`);
  userId = existing.id;
  console.log(`• ${email} already exists — refreshing its admin role.`);
} else {
  userId = created.data.user.id;
  console.log(`• created Supabase Auth user ${email}`);
}

const { error: roleError } = await supabase
  .from("admin_roles")
  .upsert({ user_id: userId, role: "admin", granted_by: "bootstrap" }, { onConflict: "user_id" });

if (roleError) {
  fail(
    `Could not grant the admin role: ${roleError.message}\n` +
      "  Has supabase/migrations/0001_racine_core.sql been applied?"
  );
}

console.log(`✓ ${email} can now sign in at /admin/login`);
console.log("  Remove the ADMIN_PASSWORD value from your shell history when you are done.");
