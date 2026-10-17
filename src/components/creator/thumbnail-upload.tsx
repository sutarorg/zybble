"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imagePath } from "@/lib/image-path";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

/** Uploads a course thumbnail to private file storage via a signed URL issued by /api/storage. */
export async function uploadThumbnail(
  courseId: string,
  file: File
): Promise<{ ok: boolean; key?: string; error?: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Thumbnail must be ${MAX_IMAGE_MB} MB or smaller.` };
  }
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upload",
      kind: "thumbnail",
      courseId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: b.error ?? "Could not start the upload." };
  }
  const grant = (await res.json()) as { url: string; key?: string };
  const put = await fetch(grant.url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return put.ok
    ? { ok: true, key: grant.key }
    : { ok: false, error: "The upload could not be stored. Try again." };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface ThumbnailUploadProps {
  courseId?: string;
  thumbnailKey?: string | null;
  currentKey?: string | null;
  disabled?: boolean;
  onFile?: (file: File | null) => void;
  onPreviewChange?: (url: string | null) => void;
}

export function ThumbnailUpload({
  courseId,
  thumbnailKey,
  currentKey,
  disabled = false,
  onFile,
  onPreviewChange,
}: ThumbnailUploadProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  const effectiveKey = thumbnailKey ?? currentKey ?? null;
  const initialUrl = effectiveKey ? imagePath("thumbnails", effectiveKey) : null;

  const [preview, setPreview] = React.useState<string | null>(initialUrl);
  const [selectedFileMeta, setSelectedFileMeta] = React.useState<{
    name: string;
    size: number;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (effectiveKey && !objectUrlRef.current) {
      const next = imagePath("thumbnails", effectiveKey);
      setPreview(next);
      onPreviewChange?.(next);
    }
  }, [effectiveKey, onPreviewChange]);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function updateLocalPreview(url: string | null) {
    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(url);
    onPreviewChange?.(url);
  }

  async function processFile(file: File | null) {
    if (!file || disabled) return;
    setError(null);
    setSaved(false);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Unsupported image format. Please choose a JPEG, PNG, or WebP file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setError(`Thumbnail must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setSelectedFileMeta({ name: file.name, size: file.size });
    updateLocalPreview(localUrl);

    if (onFile && !courseId) {
      onFile(file);
      setSaved(true);
      return;
    }

    if (!courseId) return;

    setBusy(true);
    const result = await uploadThumbnail(courseId, file);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Upload failed.");
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  function handleClearSelection() {
    setError(null);
    setSaved(false);
    setSelectedFileMeta(null);
    if (inputRef.current) inputRef.current.value = "";
    onFile?.(null);
    const fallback = effectiveKey ? imagePath("thumbnails", effectiveKey) : null;
    updateLocalPreview(fallback);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[240px_1fr] sm:items-start">
      {/* 16:9 Thumbnail Preview / Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) {
            void processFile(e.dataTransfer.files?.[0] ?? null);
          }
        }}
        onClick={() => !busy && !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={
          preview ? "Replace course thumbnail image" : "Upload course thumbnail image"
        }
        className={cn(
          "group relative aspect-video w-full overflow-hidden rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          dragging
            ? "border-primary bg-accent/60 ring-2 ring-primary/20"
            : preview
              ? "border-border bg-zinc-100 shadow-card hover:border-primary/50"
              : "border-dashed border-zinc-300 bg-accent/40 hover:border-primary/50 hover:bg-accent/60"
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Course thumbnail preview"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {!disabled ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-zinc-900 shadow-md">
                  <UploadCloud className="size-3.5 text-primary" aria-hidden="true" />
                  Replace image
                </span>
              </div>
            ) : null}
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-xs">
              16:9 cover
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-primary">
            <ImagePlus className="size-6" aria-hidden="true" />
            <p className="text-[12px] font-semibold text-foreground">
              Click or drag image here
            </p>
            <p className="text-[11px] text-muted-foreground">
              16:9 ratio · 1280 × 720 px
            </p>
          </div>
        )}

        {busy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/85 text-foreground backdrop-blur-xs">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-[11.5px] font-medium">Uploading thumbnail…</span>
          </div>
        ) : null}
      </div>

      {/* Controls & Guidance */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void processFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {preview ? "Replace thumbnail" : "Upload thumbnail"}
          </Button>

          {!courseId && selectedFileMeta && !disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          ) : null}

          {saved && !error ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800">
              <Check className="size-3" aria-hidden="true" />
              {courseId ? "Thumbnail saved" : "Ready to upload when saved"}
            </span>
          ) : null}
        </div>

        {selectedFileMeta ? (
          <p className="text-[12px] text-muted-foreground">
            Selected:{" "}
            <span className="font-medium text-foreground">{selectedFileMeta.name}</span>{" "}
            <span>({formatBytes(selectedFileMeta.size)})</span>
          </p>
        ) : null}

        <div className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
          <p>
            Supported formats:{" "}
            <strong className="font-medium text-foreground">JPEG, PNG, or WebP</strong> ·
            Max size{" "}
            <strong className="font-medium text-foreground">{MAX_IMAGE_MB} MB</strong> ·
            Recommended{" "}
            <strong className="font-medium text-foreground">1280 × 720 px (16:9)</strong>.
          </p>
          <p className="text-[11.5px] text-zinc-400">
            Displayed on the public catalog card and at the top of your course preview page. Required before submitting for review.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
