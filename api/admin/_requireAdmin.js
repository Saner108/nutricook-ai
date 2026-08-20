// Gate for the /api/admin/* routes: proves the caller is a signed-in user whose
// email is on the ADMIN_EMAILS allowlist.
import { getUser, bearer } from "../_lib/supabaseAdmin.js";
import { isAllowlisted } from "./_allowlist.js";

// Returns the verified admin's { id, email }, or null if the caller is not one.
//
// The identity checked here comes ONLY from the access token, validated by
// Supabase in getUser() — never from a query param, a custom header, or the
// request body. Those are all attacker-supplied: honouring them would let
// anyone declare themselves an admin, and would reduce every row in admin_logs
// to an unverified claim about who acted. The audit trail is only trustworthy
// because the email written into it is the one Supabase vouched for.
//
// Both failure modes (no/invalid token, and valid token that isn't allowlisted)
// collapse to null so callers can't accidentally treat "known user" as
// "authorized". Callers that need to record which of the two happened re-derive
// it on the rejected path — see api/admin/getUser.js.
export async function requireAdmin(req) {
  const user = await getUser(bearer(req));
  if (!user || !user.email) return null;
  if (!isAllowlisted(user.email)) return null;
  return { id: user.id, email: user.email };
}
