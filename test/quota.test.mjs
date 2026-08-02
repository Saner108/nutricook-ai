// Unit tests for the pure quota + streak helpers (src/lib/quota.js).
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { canGenerate, isProActive, remaining, isScanRequest, computeStreak, FREE_LIMITS } from "../src/lib/quota.js";

const NOW = new Date("2026-07-21T12:00:00.000Z");

test("isProActive: active subscription within period is Pro", () => {
  assert.equal(isProActive({ status: "active", current_period_end: "2026-08-01T00:00:00Z" }, NOW), true);
  assert.equal(isProActive({ status: "active", current_period_end: null }, NOW), true);
});

test("isProActive: expired or non-active subscription is not Pro", () => {
  assert.equal(isProActive({ status: "active", current_period_end: "2026-07-01T00:00:00Z" }, NOW), false);
  assert.equal(isProActive({ status: "canceled", current_period_end: "2026-08-01T00:00:00Z" }, NOW), false);
  assert.equal(isProActive(null, NOW), false);
});

test("canGenerate: free user is gated at the daily generation limit", () => {
  assert.equal(canGenerate(null, { generations: 0, scans: 0 }, "gen", NOW), true);
  assert.equal(canGenerate(null, { generations: FREE_LIMITS.gen - 1, scans: 0 }, "gen", NOW), true);
  assert.equal(canGenerate(null, { generations: FREE_LIMITS.gen, scans: 0 }, "gen", NOW), false);
});

test("canGenerate: free user is gated at the daily scan limit; Pro is never gated", () => {
  assert.equal(canGenerate(null, { generations: 0, scans: FREE_LIMITS.scan }, "scan", NOW), false);
  assert.equal(canGenerate(null, null, "scan", NOW), true); // no counter row yet → 0 used
  const pro = { status: "active", current_period_end: "2026-08-01T00:00:00Z" };
  assert.equal(canGenerate(pro, { generations: 99, scans: 99 }, "gen", NOW), true);
  assert.equal(canGenerate(pro, { generations: 99, scans: 99 }, "scan", NOW), true);
});

test("remaining: reports per-type remaining for free users and Infinity for Pro", () => {
  assert.deepEqual(remaining(null, { generations: 1, scans: 0 }, NOW), { gen: 2, scan: 1 });
  assert.deepEqual(remaining(null, { generations: 5, scans: 5 }, NOW), { gen: 0, scan: 0 });
  const r = remaining({ status: "active", current_period_end: null }, null, NOW);
  assert.equal(r.gen, Infinity);
  assert.equal(r.scan, Infinity);
});

test("isScanRequest: detects an image content block among messages", () => {
  assert.equal(isScanRequest([{ role: "user", content: [{ type: "image" }, { type: "text" }] }]), true);
  assert.equal(isScanRequest([{ role: "user", content: "just text" }]), false);
  assert.equal(isScanRequest([]), false);
});

test("computeStreak: counts consecutive done days ending today", () => {
  const logs = [
    { eaten_on: "2026-07-21", done: true },
    { eaten_on: "2026-07-20", done: true },
    { eaten_on: "2026-07-19", done: true },
    { eaten_on: "2026-07-17", done: true }, // gap on the 18th breaks the run
  ];
  assert.equal(computeStreak(logs, NOW), 3);
});

test("computeStreak: grace day — today unlogged but yesterday logged still counts", () => {
  const logs = [
    { eaten_on: "2026-07-20", done: true },
    { eaten_on: "2026-07-19", done: true },
  ];
  assert.equal(computeStreak(logs, NOW), 2);
});

test("computeStreak: no qualifying days yields zero", () => {
  assert.equal(computeStreak([], NOW), 0);
  assert.equal(computeStreak([{ eaten_on: "2026-07-10", done: true }], NOW), 0);
  assert.equal(computeStreak([{ eaten_on: "2026-07-21", done: false }], NOW), 0);
});
