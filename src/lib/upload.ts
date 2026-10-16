/**
 * Browser-side upload helpers.
 *
 * Uploads go to private Cloudflare R2 storage through a pre-signed URL that the
 * server issues only after checking the caller's session. No file is ever
 * converted to a data URL, and no credential ever reaches the browser.
 */

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface UploadResult {
  success: boolean;
  error?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  /**
   * The R2 key the bytes were stored under. The caller passes this to a server
   * action, which re-checks ownership and existence before attaching it to a
   * profile — an upload on its own changes nothing.
   */
  objectKey?: string;
}

export function validateProfilePicture(file: File): UploadResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { success: false, error: "Only JPEG, PNG and WebP images are allowed" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: `File size exceeds the ${MAX_AVATAR_BYTES / (1024 * 1024)} MB limit` };
  }
  return { success: true, fileName: file.name, fileSize: file.size };
}

/**
 * Requests a pre-signed upload slot from the server, then PUTs the bytes
 * directly to R2.
 */
export async function uploadAvatarFile(file: File): Promise<UploadResult> {
  const validation = validateProfilePicture(file);
  if (!validation.success) return validation;

  let grant: { key: string; url: string };
  try {
    const response = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upload",
        kind: "avatar",
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { success: false, error: body?.error ?? "Upload is not available right now" };
    }
    grant = (await response.json()) as { key: string; url: string };
  } catch {
    return { success: false, error: "Could not reach the upload service" };
  }

  const put = await fetch(grant.url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) {
    return { success: false, error: "The file could not be stored. Please try again." };
  }

  return {
    success: true,
    fileName: file.name,
    fileSize: file.size,
    objectKey: grant.key,
    fileUrl: `/api/media/avatars?key=${encodeURIComponent(grant.key)}`,
  };
}

/** Alias kept for call sites that used the old name. */
export const uploadProfilePicture = uploadAvatarFile;

export const MAX_FILE_SIZE = MAX_AVATAR_BYTES;

/** Client-side image compression before upload. */
export function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
