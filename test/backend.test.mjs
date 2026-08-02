// Unit tests for backend-side logic: quota gate, 402 response shape,
// onboarding write contract, and edge cases not covered by quota.test.mjs.
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canGenerate,
  isProActive,
  remaining,
  isScanRequest,
  computeStreak,
  FREE_LIMITS,
  utcDay,
} from "../src/lib/quota.js";

const appSrc = readFileSync(fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8");
const supabaseSrc = readFileSync(fileURLToPath(new URL("../src/lib/supabase.js", import.meta.url)), "utf8");

// ─── 402 quota gate ─────────────────────────────────────────────────────────

test("402 gate: free user exhausted generations → canGenerate false (triggers 402)", () => {
  assert.equal(canGenerate(null, { generations: FREE_LIMITS.gen, scans: 0 }, "gen"), false);
});

test("402 gate: free user exhausted scan quota → canGenerate false (triggers 402)", () => {
  assert.equal(canGenerate(null, { generations: 0, scans: FREE_LIMITS.scan }, "scan"), false);
});

test("402 gate: active Pro with exhausted counters is never blocked", () => {
  const pro = { status: "active", current_period_end: null };
  assert.equal(canGenerate(pro, { generations: 999, scans: 999 }, "gen"), true);
  assert.equal(canGenerate(pro, { generations: 999, scans: 999 }, "scan"), true);
});

test("402 gate: past_due subscription is treated as free tier", () => {
  const pastDue = { status: "past_due", current_period_end: "2099-01-01T00:00:00Z" };
  assert.equal(canGenerate(pastDue, { generations: FREE_LIMITS.gen, scans: 0 }, "gen"), false);
});

test("402 gate: canceled subscription with future period_end is still non-Pro", () => {
  const canceled = { status: "canceled", current_period_end: "2099-01-01T00:00:00Z" };
  assert.equal(isProActive(canceled), false);
  assert.equal(canGenerate(canceled, { generations: FREE_LIMITS.gen, scans: 0 }, "gen"), false);
});

test("402 gate: first request of the day (no counter row) is always allowed", () => {
  assert.equal(canGenerate(null, null, "gen"), true);
  assert.equal(canGenerate(null, null, "scan"), true);
});

// ─── remaining() edge cases ──────────────────────────────────────────────────

test("remaining: exactly at limit shows 0, overcount stays 0 (not negative)", () => {
  assert.deepEqual(remaining(null, { generations: FREE_LIMITS.gen, scans: FREE_LIMITS.scan }), { gen: 0, scan: 0 });
  assert.deepEqual(remaining(null, { generations: FREE_LIMITS.gen + 10, scans: FREE_LIMITS.scan + 10 }), { gen: 0, scan: 0 });
});

test("remaining: one gen used leaves correct count", () => {
  assert.deepEqual(remaining(null, { generations: 1, scans: 0 }), { gen: 2, scan: 1 });
});

// ─── isScanRequest ───────────────────────────────────────────────────────────

test("isScanRequest: nested image block inside user turn is detected", () => {
  const msg = [{ role: "user", content: [{ type: "image", source: { type: "base64" } }, { type: "text", text: "what ingredients?" }] }];
  assert.equal(isScanRequest(msg), true);
});

test("isScanRequest: text-only array content is not a scan", () => {
  assert.equal(isScanRequest([{ role: "user", content: [{ type: "text", text: "give me a recipe with chicken" }] }]), false);
});

test("isScanRequest: string content (non-array) is not a scan", () => {
  assert.equal(isScanRequest([{ role: "user", content: "just text" }]), false);
});

// ─── streak edge cases ───────────────────────────────────────────────────────

const TODAY = new Date("2026-08-02T14:00:00.000Z");

test("computeStreak: single day today is a streak of 1", () => {
  assert.equal(computeStreak([{ eaten_on: "2026-08-02", done: true }], TODAY), 1);
});

test("computeStreak: done=false entries are excluded", () => {
  const logs = [
    { eaten_on: "2026-08-02", done: false },
    { eaten_on: "2026-08-01", done: true },
    { eaten_on: "2026-07-31", done: true },
  ];
  assert.equal(computeStreak(logs, TODAY), 2);
});

test("computeStreak: 14-day unbroken run", () => {
  const logs = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(TODAY);
    d.setUTCDate(d.getUTCDate() - i);
    return { eaten_on: utcDay(d), done: true };
  });
  assert.equal(computeStreak(logs, TODAY), 14);
});

test("computeStreak: gap two days ago breaks the run at 2", () => {
  const logs = [
    { eaten_on: "2026-08-02", done: true },
    { eaten_on: "2026-08-01", done: true },
    // gap on 2026-07-31
    { eaten_on: "2026-07-30", done: true },
  ];
  assert.equal(computeStreak(logs, TODAY), 2);
});

// ─── utcDay ─────────────────────────────────────────────────────────────────

test("utcDay: midnight and end-of-day both return the same date string", () => {
  assert.equal(utcDay(new Date("2026-08-02T00:00:00.000Z")), "2026-08-02");
  assert.equal(utcDay(new Date("2026-08-02T23:59:59.999Z")), "2026-08-02");
});

// ─── onboarding write contract (source-level) ────────────────────────────────

test("onboarding: app derives macro targets from goal preset", () => {
  assert.match(appSrc, /kcal_target|kcalTarget/, "onboarding must write calorie target");
  assert.match(appSrc, /protein_target|proteinTarget/, "onboarding must write protein target");
});

test("demo mode: supabase client reads URL from env var (not hardcoded)", () => {
  assert.match(supabaseSrc, /VITE_SUPABASE_URL|import\.meta\.env/, "supabase client must read from env");
});

test("security: service-role key must not appear in frontend source", () => {
  assert.doesNotMatch(appSrc, /service_role|SERVICE_ROLE/, "service-role key must never appear in the frontend bundle");
});

test("security: no raw Anthropic API key in frontend", () => {
  assert.doesNotMatch(appSrc, /sk-ant-[a-zA-Z0-9]/, "Anthropic key must not be hardcoded in frontend");
});
