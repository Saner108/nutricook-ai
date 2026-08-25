// Gate for the /api/admin/* routes: proves the caller is a signed-in user whose
// email is on the ADMIN_EMAILS allowlist.
import { getUser, bearer } from "../_lib/supabaseAdmin.js";
import { isAllowlisted } from "./_allowlist.js";

// Returns a discriminated result — never a bare boolean/null — so callers can
// tell the two distinct failure modes apart without re-verifying the token:
//   success: { ok: true,  id, email }
//   failure: { ok: false, reason: "no_valid_token" | "not_allowlisted",
//              caller: {id,email} | null }
// `caller` is the verified-but-not-allowlisted user when that's the failure
// reason, and null when there was no valid token at all (nothing was verified,
// so there is no identity to report).
//
// The identity checked here comes ONLY from the access token, validated by
// Supabase in getUser() — never from a query param, a custom header, or the
// request body. Those are all attacker-supplied: honouring them would let
// anyone declare themselves an admin, and would reduce every row in admin_logs
// to an unverified claim about who acted. The audit trail is only trustworthy
// because the email written into it is the one Supabase vouched for.
export async function requireAdmin(req) {
  const user = await getUser(bearer(req));
  if (!user || !user.email) return { ok: false, reason: "no_valid_token", caller: null };
  if (!isAllowlisted(user.email)) return { ok: false, reason: "not_allowlisted", caller: { id: user.id, email: user.email } };
  return { ok: true, id: user.id, email: user.email };
}
