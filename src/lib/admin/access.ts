/**
 * Platform administrator authorisation.
 *
 * `/admin` is an owner-only surface: it sees every user, every workspace and
 * every subscription, so it needs a stronger gate than workspace membership.
 * That gate is a server-side allowlist of Supabase Auth user UUIDs held in
 * `ZYBBLE_ADMIN_USER_IDS`.
 *
 * What is deliberately NOT used as an authorisation signal:
 *
 *  - **`user_metadata`** — writable by the user it describes. Anyone holding
 *    their own access token could add `{"role":"admin"}` to themselves, so it
 *    is an identity claim, never a permission.
 *  - **email address / domain** — a user can change their email, and Supabase
 *    only treats `email_confirmed_at` as verified *for the current address*.
 *    An address is a label, not a credential.
 *  - **workspace role (`owner`, `admin`)** — a per-tenant concept. Being the
 *    owner of a workspace says you may administer that workspace, not the
 *    platform, so a customer who upgrades and invites a team can never
 *    elevate themselves here.
 *
 * The allowlist is environment configuration, which means changing who is an
 * admin requires a deployment by someone who can already deploy — the same
 * trust boundary as the service-role key.
 *
 * Nothing in this module touches the database or the admin client; it is pure
 * configuration so it can run in the proxy (edge) as well as in Node.
 */

import { env } from "@/lib/env";

/**
 * A canonical UUID. Version nibbles are constrained to 1-5 and the variant to
 * [89ab], which rejects the `00000000-0000-0000-0000-000000000000` shape and
 * other strings that merely look like UUIDs.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminAllowlist = {
  /** False when no usable id was found, which denies everyone. */
  configured: boolean;
  /** Lower-cased, de-duplicated, valid UUIDs. Empty when unset. */
  ids: readonly string[];
  /** Entries that were present but malformed — surfaced in /admin/system. */
  invalid: readonly string[];
  /** False when the variable is absent or contains nothing usable. */
  reason: "ok" | "missing" | "empty" | "no_valid_entries";
};

function parseAllowlist(raw: string | undefined): AdminAllowlist {
  if (raw === undefined) {
    return { configured: false, ids: [], invalid: [], reason: "missing" };
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return { configured: false, ids: [], invalid: [], reason: "empty" };
  }

  const ids = new Set<string>();
  const invalid: string[] = [];

  for (const entry of entries) {
    if (UUID.test(entry)) {
      // Supabase hands out lower-case UUIDs. Normalising both sides means a
      // copy-pasted upper-case id still matches, without weakening the check.
      ids.add(entry.toLowerCase());
    } else {
      invalid.push(entry);
    }
  }

  if (ids.size === 0) {
    return { configured: false, ids: [], invalid, reason: "no_valid_entries" };
  }

  return { configured: true, ids: [...ids], invalid, reason: "ok" };
}

export function adminAllowlist(): AdminAllowlist {
  return parseAllowlist(env().ZYBBLE_ADMIN_USER_IDS);
}

/**
 * Is this user a platform admin?
 *
 * Fails closed: `null`, `undefined` and an empty string are all false, and an
 * unconfigured allowlist denies everyone — including the founder, until the
 * variable is set.
 */
export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;

  const { ids } = adminAllowlist();
  return ids.includes(userId.toLowerCase());
}

/** How many accounts are currently allowed in. Zero is a valid, safe state. */
export function adminCount(): number {
  return adminAllowlist().ids.length;
}
