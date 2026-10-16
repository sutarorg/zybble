/**
 * Upload limits shared by the browser and the server.
 *
 * The server (`/api/storage`) is the authority — it rejects anything outside
 * these bounds — and the client pre-checks the same numbers so a creator is
 * told the real limit *before* an upload starts instead of receiving a
 * mid-flight rejection.
 */

/** Image uploads: course thumbnails and avatars. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Downloadable course resources (no executables, no web content). */
export const ALLOWED_RESOURCE_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
];

export const MAX_RESOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Human-readable caps for helper text, e.g. `5 MB`. */
export const MAX_RESOURCE_MB = Math.round(MAX_RESOURCE_BYTES / (1024 * 1024));
export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
