// Pure helpers for free-tier quota + Pro status + streak.
// No React, no Supabase, no DOM — kept pure so they can be unit-tested directly
// (test/quota.test.mjs) and reused by both the frontend and the serverless proxy.

export const FREE_LIMITS = { gen: 3, scan: 1 };

// A subscription counts as Pro only while active AND not past its period end.
// sub: a `subscriptions` row ({ status, current_period_end }) or null.
export function isProActive(sub, now = new Date()) {
  if (!sub || sub.status !== "active") return false;
  if (!sub.current_period_end) return true; // active with no known end → treat as Pro
  return new Date(sub.current_period_end).getTime() > now.getTime();
}

// Can this user run `kind` ('gen' | 'scan') right now?
// Pro → always. Otherwise compare today's usage against the free limit.
// counters: today's `usage_counters` row ({ generations, scans }) or null.
export function canGenerate(sub, counters, kind = "gen", now = new Date()) {
  if (isProActive(sub, now)) return true;
  const used = kind === "scan" ? (counters?.scans ?? 0) : (counters?.generations ?? 0);
  const limit = kind === "scan" ? FREE_LIMITS.scan : FREE_LIMITS.gen;
  return used < limit;
}

// How many of each type remain today for a free user (0 when Pro-unlimited → Infinity).
export function remaining(sub, counters, now = new Date()) {
  if (isProActive(sub, now)) return { gen: Infinity, scan: Infinity };
  return {
    gen: Math.max(0, FREE_LIMITS.gen - (counters?.generations ?? 0)),
    scan: Math.max(0, FREE_LIMITS.scan - (counters?.scans ?? 0)),
  };
}

// A request is a fridge-scan (not a recipe generation) when any message carries an
// image content block — mirrors how the frontend builds the vision request.
export function isScanRequest(messages) {
  return (Array.isArray(messages) ? messages : []).some(
    m => Array.isArray(m?.content) && m.content.some(c => c && c.type === "image")
  );
}

// UTC calendar day for a Date (YYYY-MM-DD), so quota + streak math never drifts by timezone.
export function utcDay(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}

// Consecutive days ending today (or yesterday, if today isn't logged yet) that have
// at least one completed meal. logs: array of { eaten_on: 'YYYY-MM-DD', done }.
export function computeStreak(logs, today = new Date()) {
  const doneDays = new Set(
    (Array.isArray(logs) ? logs : [])
      .filter(l => l && l.done !== false)
      .map(l => String(l.eaten_on).slice(0, 10))
  );
  const cursor = new Date(`${utcDay(today)}T00:00:00.000Z`);
  // Grace: if today has no logged meal yet, an unbroken streak can still end yesterday.
  if (!doneDays.has(utcDay(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (doneDays.has(utcDay(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
