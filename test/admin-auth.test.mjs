// Unit tests for the admin route's auth/allowlist building blocks
// (api/admin/_allowlist.js, api/admin/_requireAdmin.js, api/_lib/supabaseAdmin.js).
//
// api/_lib/supabaseAdmin.js talks to Supabase via the module-level global
// `fetch`, not an injectable one, so behavioral mocking of a real network call
// (e.g. "requireAdmin() denies a verified-but-not-allowlisted user", or
// "getUserByEmail() confirms a genuine not-found after scanning every page")
// isn't practical without adding new test infrastructure — out of scope here.
// What IS covered below are the paths that resolve deterministically without
// ever reaching the network, which happens to include the single most
// important behavior in this feature per CLAUDE.md: an empty/unset
// ADMIN_EMAILS must deny everyone.
//
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { requireAdmin } from "../api/admin/_requireAdmin.js";
import { getUserByEmail } from "../api/_lib/supabaseAdmin.js";

const allowlistUrl = fileURLToPath(new URL("../api/admin/_allowlist.js", import.meta.url));

// ADMIN_EMAILS is computed once at module load from process.env, so a test
// that needs a different env state re-imports the module fresh via a
// cache-busting query string rather than mutating a shared singleton that
// every other test (and the real handler, if ever imported in-process) would
// also see.
async function freshAllowlist(adminEmailsEnvValue) {
  const prev = process.env.ADMIN_EMAILS;
  if (adminEmailsEnvValue === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = adminEmailsEnvValue;
  try {
    return await import(`${allowlistUrl}?t=${Date.now()}-${Math.random()}`);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  }
}

// ─── isAllowlisted() ─────────────────────────────────────────────────────────

test("isAllowlisted: unset ADMIN_EMAILS denies everyone (fail closed)", async () => {
  const { isAllowlisted } = await freshAllowlist(undefined);
  assert.equal(isAllowlisted("anyone@example.com"), false);
  assert.equal(isAllowlisted(""), false);
});

test("isAllowlisted: empty/blank ADMIN_EMAILS denies everyone (fail closed)", async () => {
  const { isAllowlisted: isAllowlistedEmpty } = await freshAllowlist("");
  assert.equal(isAllowlistedEmpty("anyone@example.com"), false);

  const { isAllowlisted: isAllowlistedBlank } = await freshAllowlist(" , , ");
  assert.equal(isAllowlistedBlank("anyone@example.com"), false);
});

test("isAllowlisted: case-insensitive match against a configured allowlist", async () => {
  const { isAllowlisted } = await freshAllowlist("Admin@Example.com, second@example.com");
  assert.equal(isAllowlisted("admin@example.com"), true);
  assert.equal(isAllowlisted("ADMIN@EXAMPLE.COM"), true);
  assert.equal(isAllowlisted("Admin@Example.com"), true);
  assert.equal(isAllowlisted("second@EXAMPLE.com"), true);
  assert.equal(isAllowlisted("nobody@example.com"), false);
});

// ─── requireAdmin() discriminated result ────────────────────────────────────

test("requireAdmin: no Authorization header → { ok:false, reason:'no_valid_token', caller:null }", async () => {
  const req = { headers: {} };
  const result = await requireAdmin(req);
  assert.deepEqual(result, { ok: false, reason: "no_valid_token", caller: null });
});

test("requireAdmin: malformed Authorization header (not 'Bearer ...') → no_valid_token", async () => {
  const req = { headers: { authorization: "Basic sometoken" } };
  const result = await requireAdmin(req);
  assert.deepEqual(result, { ok: false, reason: "no_valid_token", caller: null });
});

// ─── getUserByEmail() null vs undefined contract ────────────────────────────
// This test process has no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set, so
// supabaseConfigured is false and getUserByEmail() short-circuits before ever
// calling fetch — which is itself one of the documented "lookup could not be
// completed" cases and resolves to undefined, not null. The "confirmed
// not-found after scanning every page" (null) branch requires a mocked
// multi-page GoTrue response and isn't reachable without fetch injection.

test("getUserByEmail: lookup that cannot be attempted resolves to undefined, not null", async () => {
  const result = await getUserByEmail("someone@example.com");
  assert.equal(result, undefined);
  assert.notEqual(result, null); // guards against the old bug: both used to collapse to null
});

test("getUserByEmail: empty/missing email also resolves to undefined (lookup not attempted)", async () => {
  assert.equal(await getUserByEmail(""), undefined);
  assert.equal(await getUserByEmail(undefined), undefined);
});
