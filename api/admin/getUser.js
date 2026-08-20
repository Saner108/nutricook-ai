// GET /api/admin/getUser?email=someone@example.com
//
// Admin-only lookup of one user's app-side state (profile + subscription).
// Requires: Authorization: Bearer <access token> for a user whose email is in
// ADMIN_EMAILS. Every call — allowed or denied — is recorded in admin_logs
// before any data is returned.
import { supabaseConfigured, getUser, bearer, getUserByEmail, selectOne } from "../_lib/supabaseAdmin.js";
import { requireAdmin } from "./_requireAdmin.js";
import { logAdminAction } from "./_logAction.js";

const ACTION = "admin_get_user";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  // api/generate.js falls back to an open proxy when Supabase is absent so demo
  // mode keeps working. An admin route must never do that: with no way to
  // verify a token there is no way to authorize anyone, and no way to write the
  // audit row either. Unavailable is the only correct answer.
  if (!supabaseConfigured) {
    res.status(503).json({ error: { message: "Admin API unavailable" } });
    return;
  }

  // Target email comes from the query string; the *caller's* identity never does.
  const raw = req.query?.email;
  const email = (typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] || "" : "").trim();

  const admin = await requireAdmin(req);
  if (!admin) {
    // requireAdmin() intentionally collapses "no/invalid token" and "valid
    // token, not allowlisted" into null. Re-verify here purely to record
    // whichever identity we actually have: a signed-in non-admin is logged by
    // name, an unauthenticated caller leaves those columns null (admin_logs
    // allows that on purpose). One extra call, on the rejected path only.
    const caller = await getUser(bearer(req));
    await logAdminAction({
      adminUserId: caller?.id || null,
      adminEmail: caller?.email || null,
      action: ACTION,
      outcome: "denied",
      targetUserEmail: email || null,
      details: { reason: caller ? "not_allowlisted" : "no_valid_token" },
    });
    // Deliberately opaque and identical in both cases: never reveal whether the
    // token was valid, whether the caller is known, or whether the target email
    // exists. Denials are also not blocked on the audit write — there is no
    // privileged data to withhold, and a logging outage must not turn into an
    // open door.
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  if (!email) {
    res.status(400).json({ error: { message: "Missing required query param: email" } });
    return;
  }

  const target = await getUserByEmail(email);
  // profiles has no email column (the address lives in auth.users), which is
  // why the lookup goes through the GoTrue admin API first and these reads are
  // keyed by the resolved user id.
  const profile = target ? await selectOne("profiles", { id: target.id }) : null;
  const subscription = target ? await selectOne("subscriptions", { user_id: target.id }) : null;
  // usage_counters is keyed (user_id, used_on), so a single row means picking a
  // day; guessing one here would return a confidently wrong number. Skipped on
  // purpose rather than guessed.

  // FAIL CLOSED: the audit row is written BEFORE any data goes back, and a
  // failed write aborts the whole action. This is deliberately the OPPOSITE of
  // the fail-open policy in api/generate.js, where a failed consume_quota lets
  // the request through. The asymmetry is intentional: failing open on metering
  // at worst gives away one generation and never blocks a paying user, while
  // failing open on an audit log means one person read another person's account
  // data with no record that it ever happened. A refused read is recoverable
  // (retry it); an unlogged privileged read is not.
  const logged = await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: ACTION,
    outcome: "ok",
    targetUserId: target?.id || null,
    targetUserEmail: email,
    details: { found: Boolean(target) },
  });
  if (!logged) {
    res.status(500).json({ error: { message: "Audit log write failed — action aborted" } });
    return;
  }

  if (!target) {
    res.status(404).json({ error: { message: "User not found" } });
    return;
  }

  res.status(200).json({
    user: {
      ...(profile || {}),
      id: target.id,
      email: target.email,
      subscription: subscription || null,
    },
  });
}
