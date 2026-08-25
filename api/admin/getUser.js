// GET /api/admin/getUser?email=someone@example.com
//
// Admin-only lookup of one user's app-side state (profile + subscription).
// Requires: Authorization: Bearer <access token> for a user whose email is in
// ADMIN_EMAILS. Every call — allowed or denied — is recorded in admin_logs
// before any data is returned.
import { supabaseConfigured, getUserByEmail, selectOne } from "../_lib/supabaseAdmin.js";
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

  // Validate the target email BEFORE requireAdmin() runs or any audit row is
  // written. This route is reachable by anyone, with or without a token — that
  // is by design, since a denied attempt is itself audit-worthy — which also
  // means the `email` param is attacker-controlled input on every request,
  // including unauthenticated ones. Rejecting an obviously malformed value here
  // keeps it out of admin_logs entirely instead of writing a row for it.
  // This is NOT rate limiting: a flood of short, well-formed email-shaped
  // strings still reaches requireAdmin() and gets logged on every single call.
  // Full rate limiting of unauthenticated callers on this route is a known
  // open gap — there is no user id to key check_rate_limit on for an anonymous
  // caller, so it would need IP-based limiting, which is a separate
  // schema/infra decision not made here.
  if (!email || email.length > 254 || !email.includes("@")) {
    res.status(400).json({ error: { message: "Missing or invalid required query param: email" } });
    return;
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    // requireAdmin() now returns which of the two denial reasons applies
    // ("no_valid_token" vs "not_allowlisted") plus the verified-but-unlisted
    // caller's identity when there is one, so this branch no longer needs a
    // second getUser() call just to find out what to log.
    await logAdminAction({
      adminUserId: admin.caller?.id || null,
      adminEmail: admin.caller?.email || null,
      action: ACTION,
      outcome: "denied",
      targetUserEmail: email,
      details: { reason: admin.reason },
    });
    // Deliberately opaque and identical in both cases: never reveal whether the
    // token was valid, whether the caller is known, or whether the target email
    // exists. Denials are also not blocked on the audit write — there is no
    // privileged data to withhold, and a logging outage must not turn into an
    // open door.
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  const target = await getUserByEmail(email);

  if (target === undefined) {
    // getUserByEmail() distinguishes "confirmed not found" (null) from "the
    // lookup itself could not be completed" (undefined — a GoTrue page came
    // back !r.ok, a fetch threw, or the response shape was unexpected). This is
    // the second case: there is nothing resolved to read profiles/subscriptions
    // with, so those reads are skipped, and the caller gets a 502 instead of a
    // false "not found".
    const logged = await logAdminAction({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: ACTION,
      outcome: "error",
      targetUserEmail: email,
      details: { reason: "lookup_failed" },
    });
    if (!logged) {
      // Same fail-closed rule as the success path below: no response goes out
      // without a matching audit record, even an error response.
      res.status(500).json({ error: { message: "Audit log write failed — action aborted" } });
      return;
    }
    res.status(502).json({ error: { message: "Could not look up user — try again" } });
    return;
  }

  // profiles has no email column (the address lives in auth.users), which is
  // why the lookup goes through the GoTrue admin API first and these reads are
  // keyed by the resolved user id. The two reads are independent of each other,
  // so they run concurrently rather than one-after-the-other.
  const [profile, subscription] = target
    ? await Promise.all([
        selectOne("profiles", { id: target.id }),
        selectOne("subscriptions", { user_id: target.id }),
      ])
    : [null, null];
  // usage_counters is keyed (user_id, used_on), so a single row means picking a
  // day; guessing one here would return a confidently wrong number. Skipped on
  // purpose rather than guessed.

  // FAIL CLOSED: the audit row is written BEFORE any response goes back to the
  // caller. Note what this does and doesn't guarantee: by this point the reads
  // above (if any) have already executed — a failed audit write doesn't undo
  // them — so the actual guarantee is narrower than "aborts the whole action":
  // no privileged data is ever returned to a caller without a corresponding
  // audit record. This is deliberately the OPPOSITE of the fail-open policy in
  // api/generate.js, where a failed consume_quota lets the request through.
  // The asymmetry is intentional: failing open on metering at worst gives away
  // one generation and never blocks a paying user, while failing open on
  // returning this response means one person read another person's account
  // data with no record that it ever happened. A refused response is
  // recoverable (retry it); an unlogged privileged read is not.
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
