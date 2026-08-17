// Append-only audit trail for privileged admin actions (db/migration_admin_logs.sql).
import { insertRow } from "../_lib/supabaseAdmin.js";

// Write exactly one admin_logs row. Returns true only if the row was stored.
//
// Uses insertRow(), not upsert(): this table is append-only, and a
// merge-duplicates insert could overwrite an existing audit record.
//
// admin_user_id / admin_email are nullable in the schema precisely so a denied
// attempt with no verified identity can still be recorded — an audit log that
// can only describe authorized successes is not a security control. Pass
// whichever identity actually exists; null is a legitimate value here.
//
// `details` must stay small and non-sensitive (a reason string, a flag, a
// count). Never put request/response bodies, tokens or Stripe secrets in it.
export async function logAdminAction({
  adminUserId = null,
  adminEmail = null,
  action,
  outcome = "ok",
  targetUserId = null,
  targetUserEmail = null,
  details = {},
} = {}) {
  const row = {
    admin_user_id: adminUserId || null,
    admin_email: typeof adminEmail === "string" && adminEmail ? adminEmail.trim().toLowerCase() : null,
    action,
    outcome,                                  // 'ok' | 'denied' | 'error' (checked by the table)
    target_user_id: targetUserId || null,
    target_user_email: typeof targetUserEmail === "string" && targetUserEmail ? targetUserEmail.trim().toLowerCase() : null,
    details: details && typeof details === "object" ? details : {},  // column is jsonb NOT NULL
  };

  const ok = await insertRow("admin_logs", row);
  if (!ok) {
    // The _lib helpers swallow their errors and just return falsy, so this is
    // the only signal a failed audit write leaves in the Vercel logs. Include
    // enough of the attempt to reconstruct it by hand if the row never landed.
    console.error("admin_logs write failed", {
      action: row.action,
      outcome: row.outcome,
      admin_user_id: row.admin_user_id,
      admin_email: row.admin_email,
      target_user_id: row.target_user_id,
      target_user_email: row.target_user_email,
      details: row.details,
    });
  }
  return ok;
}
