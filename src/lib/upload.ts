/**
 * File upload utilities for profile pictures and other media.
 */

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface UploadResult {
  success: boolean;
  error?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Validates an uploaded file for profile picture.
 * @param file - The file to validate
 * @returns UploadResult with validation status
 */
export function validateProfilePicture(file: File): UploadResult {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Only JPEG, PNG, WebP, and GIF images are allowed",
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return {
    success: true,
    fileName: file.name,
    fileSize: file.size,
  };
}

/**
 * Converts a File to a base64 data URL for immediate display.
 * In production, you would upload to a server and get a URL back.
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Handles profile picture upload with validation and conversion to data URL.
 * @param file - The file from input
 * @returns Promise with UploadResult
 */
export async function uploadProfilePicture(file: File): Promise<UploadResult> {
  const validation = validateProfilePicture(file);
  if (!validation.success) {
    return validation;
  }

  try {
    const dataUrl = await fileToDataURL(file);
    return {
      ...validation,
      success: true,
      fileUrl: dataUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to process the image. Please try again.",
    };
  }
}

/**
 * Compresses an image file to reduce size while maintaining quality.
 * Useful for large profile pictures.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with bilinear scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      resolve(file); // Fallback to original if image fails to load
    };
    img.src = URL.createObjectURL(file);
  });
}

export { MAX_FILE_SIZE };
