/**
 * Builds the same-origin URL for an image stored in the private R2 bucket.
 *
 * Client-safe: the bucket stays private and images are streamed through
 * `/api/media/[kind]`, so no public bucket policy is required.
 */
export function imagePath(kind: "thumbnails" | "avatars", key: string | null | undefined): string {
  if (!key || key.includes("..") || key.startsWith("/")) return "";
  return `/api/media/${kind}?key=${encodeURIComponent(key)}`;
}
