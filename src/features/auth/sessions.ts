import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { AuthSessionRow } from "@/lib/supabase/database.types";

/**
 * Signed-in devices.
 *
 * Supabase Auth does not expose a per-device session list to the JS client, so
 * the app records what it can observe at sign-in and shows it back on the
 * account screen: browser and OS from the user agent, city and country from the
 * platform's geo headers.
 *
 * Two deliberate limits:
 *  - the raw IP is never stored. Only a SHA-256 of it, used solely to
 *    recognise a returning device instead of creating a duplicate row.
 *  - recording is best-effort. A sign-in must never fail because its audit
 *    side-effect did, so every path here swallows and logs.
 */

/**
 * A device name a person recognises — "Chrome on macOS", "Safari on iPhone" —
 * rather than a raw UA string.
 *
 * Order matters: Edge's user agent also contains "chrome" and "safari", and
 * Chrome's contains "safari", so the more specific checks come first.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.toLowerCase();

  let browser = "Unknown browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("opr/") || ua.includes("opera")) browser = "Opera";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("safari/")) browser = "Safari";

  let os = "";
  if (ua.includes("iphone")) os = "iPhone";
  else if (ua.includes("ipad")) os = "iPad";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("mac os x") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("linux")) os = "Linux";

  return os ? `${browser} on ${os}` : browser;
}

export type SessionLocation = {
  city: string;
  region: string;
  country: string;
};

/**
 * City and country from the platform's geo headers.
 *
 * Vercel populates these at the edge. Any other host simply does not set them,
 * in which case the device records no location rather than a guess — an empty
 * string, never "Unknown" and never a lookup against a third-party API.
 */
export function locationFromHeaders(headers: Headers): SessionLocation {
  const read = (name: string): string => {
    const raw = headers.get(name);
    if (!raw) return "";
    try {
      return decodeURIComponent(raw).slice(0, 80);
    } catch {
      // Malformed percent-encoding: fall back to the literal value.
      return raw.slice(0, 80);
    }
  };

  return {
    city: read("x-vercel-ip-city"),
    region: read("x-vercel-ip-country-region"),
    country: read("x-vercel-ip-country"),
  };
}

function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

/** Record (or refresh) the device this sign-in came from. Never throws. */
export async function recordSession(input: {
  userId: string;
  userAgent: string | null;
  headers: Headers;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const location = locationFromHeaders(input.headers);
    const ip = clientIp(input.headers);

    const { error } = await admin
      .from("auth_sessions")
      .upsert(
        {
          user_id: input.userId,
          device_label: describeUserAgent(input.userAgent),
          ip_hash: ip ? createHash("sha256").update(ip).digest("hex") : "",
          city: location.city,
          region: location.region,
          country: location.country,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_label,ip_hash,city,country" },
      );

    if (error) {
      logger.warn("auth.session_record_failed", { error: error.message });
    }
  } catch (error) {
    logger.warn("auth.session_record_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export type DeviceSession = {
  id: string;
  device: string;
  location: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

/**
 * Join the city/region/country into one readable string.
 *
 * Region is only worth showing when it adds something to the city, and city is
 * omitted entirely when the platform supplied no geo headers at all.
 */
export function formatLocation(row: Pick<AuthSessionRow, "city" | "region" | "country">): string | null {
  const place = [row.city, row.region === row.city ? "" : row.region, row.country]
    .map((part) => part.trim())
    .filter(Boolean);

  // Deduplicate: some platforms report the same value for city and country.
  const unique = place.filter((part, index) => place.indexOf(part) === index);

  return unique.length > 0 ? unique.join(", ") : null;
}

export async function listSessions(userId: string): Promise<DeviceSession[]> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("auth_sessions")
    .select("id, device_label, city, region, country, first_seen_at, last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (error) {
    logger.error("auth.session_list_failed", { error: error.message });
    return [];
  }

  return ((data ?? []) as Pick<
    AuthSessionRow,
    "id" | "device_label" | "city" | "region" | "country" | "first_seen_at" | "last_seen_at"
  >[]).map((row) => ({
    id: row.id,
    device: row.device_label,
    location: formatLocation(row),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

/** Forget one device. Scoped to the owner, so a guessed id deletes nothing. */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("auth_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    logger.error("auth.session_revoke_failed", { error: error.message });
    throw new Error("Could not remove that device.");
  }
}
