/**
 * Profile avatar persistence.
 *
 * Uploading an avatar is two steps: `/api/storage` issues a pre-signed PUT into
 * the caller's own namespace, the browser uploads the bytes, and then a server
 * action confirms the key. Confirmation is deliberately separate from issuing the
 * URL — pointing `profiles.avatar_key` at an object before the PUT has landed
 * would leave a profile referencing a file that does not exist, and every avatar
 * on the site would render broken.
 *
 * The key is re-derived and re-checked here rather than trusted: it must belong
 * to the signed-in user's own `avatar/` namespace, the object must exist, and it
 * must still be an image inside the size limit.
 */

import "server-only";
import { isR2Configured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  buildObjectKey,
  deleteObject,
  headObject,
} from "@/lib/server/r2";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** `creators/<ownerId>/avatar/<sha256_16>-<safe-file-name>` — see `buildObjectKey`. */
const AVATAR_KEY = new RegExp(`^creators/(${UUID})/avatar/[0-9a-f]{16}-[^/]+$`);

/** True when `key` is an avatar object inside `userId`'s own namespace. */
export function isOwnAvatarKey(userId: string, key: unknown): key is string {
  if (typeof key !== "string") return false;
  const match = AVATAR_KEY.exec(key);
  return match !== null && match[1] === userId;
}

export type AvatarUploadResult = { ok: true; key: string } | { ok: false; error: string };

/**
 * Verifies an uploaded object and attaches it to the profile.
 *
 * Returns a user-readable error rather than throwing, because the caller is a
 * server action whose result is rendered as a toast.
 */
export async function confirmAvatarUpload(userId: string, key: unknown): Promise<AvatarUploadResult> {
  if (!isOwnAvatarKey(userId, key)) {
    return { ok: false, error: "That image is not in your upload folder" };
  }
  if (!isR2Configured()) {
    return { ok: false, error: "File storage is not configured yet" };
  }

  let size = 0;
  let contentType = "";
  try {
    const head = await headObject(key);
    size = Number(head.ContentLength ?? 0);
    contentType = String(head.ContentType ?? "");
  } catch {
    // A missing object means the browser never completed the PUT.
    return { ok: false, error: "The upload did not finish — please try again" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
    return { ok: false, error: "Avatars must be a JPEG, PNG or WebP image" };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That image is empty" };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Avatars must be ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB or smaller` };
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: "Profile storage is unavailable" };

  const { data: profile } = await service
    .from("profiles")
    .select("avatar_key")
    .eq("id", userId)
    .maybeSingle();
  const previousKey = (profile?.avatar_key as string | null) ?? null;

  const { error } = await service.from("profiles").update({ avatar_key: key }).eq("id", userId);
  if (error) {
    console.error("[avatar] could not save the profile image", { user: userId, reason: error.message.slice(0, 200) });
    return { ok: false, error: "Could not save your profile image" };
  }

  // The replaced image is now unreachable; dropping it keeps the bucket honest.
  // Best-effort: a failed delete must never fail the upload.
  if (previousKey && previousKey !== key && isOwnAvatarKey(userId, previousKey)) {
    try {
      await deleteObject(previousKey);
    } catch {
      console.warn("[avatar] left an orphaned image behind", { user: userId });
    }
  }

  return { ok: true, key };
}

/**
 * Builds the avatar key for a signed-in user before the upload starts.
 *
 * Exported so the browser-facing storage route and the confirming action agree
 * on exactly one shape.
 */
export function avatarObjectKey(userId: string, fileName: string): string {
  return buildObjectKey({ ownerId: userId, kind: "avatar", fileName });
}
