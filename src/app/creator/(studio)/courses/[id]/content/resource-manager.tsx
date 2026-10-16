"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { deleteResource } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imagePath } from "@/lib/image-path";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  MAX_RESOURCE_BYTES,
  MAX_RESOURCE_MB,
} from "@/lib/upload-limits";

export interface CourseResource {
  id: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Course thumbnail and downloadable resources — wizard step 3.
 *
 * Uploads are pre-signed PUTs issued by `/api/storage` after the server verifies
 * ownership; the R2 bucket is private, so a download link is minted per request
 * and only for an owner or an entitled learner. The size and type limits here
 * mirror the server's exactly (`@/lib/upload-limits`) — success is reported only
 * after the storage service has actually accepted the bytes.
 */
export function ResourceManager({
  courseId,
  thumbnailKey,
  resources,
  editable,
}: {
  courseId: string;
  thumbnailKey: string | null;
  resources: CourseResource[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const resourceInput = React.useRef<HTMLInputElement>(null);
  const thumbnailInput = React.useRef<HTMLInputElement>(null);

  async function upload(file: File, kind: "thumbnail" | "resource") {
    const limitBytes = kind === "thumbnail" ? MAX_IMAGE_BYTES : MAX_RESOURCE_BYTES;
    const limitMb = kind === "thumbnail" ? MAX_IMAGE_MB : MAX_RESOURCE_MB;
    if (file.size > limitBytes) {
      setError(`“${file.name}” is larger than ${limitMb} MB. Choose a smaller file.`);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(`Uploading “${file.name}”…`);
    try {
      const grantResponse = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          kind,
          courseId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          title: kind === "resource" ? title || file.name : undefined,
        }),
      });
      if (!grantResponse.ok) {
        const payload = (await grantResponse.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not start the upload");
        setStatus(null);
        return;
      }
      const grant = (await grantResponse.json()) as { url: string };
      const putResponse = await fetch(grant.url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putResponse.ok) {
        setError("The file store rejected the upload. Please try again.");
        setStatus(null);
        return;
      }
      if (kind === "resource") setTitle("");
      setStatus(`“${file.name}” uploaded.`);
      router.refresh();
    } catch {
      setError("The upload failed. Please try again.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function download(resourceId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", resourceId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not create a download link");
        return;
      }
      const { url } = (await response.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {status}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Course thumbnail</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Required before submission. JPEG, PNG or WebP up to {MAX_IMAGE_MB} MB.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {thumbnailKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePath("thumbnails", thumbnailKey)}
              alt="Current course thumbnail"
              className="h-24 w-40 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-400">
              <ImageIcon className="size-6" aria-hidden />
              <span className="text-[11px]">No thumbnail yet</span>
            </div>
          )}
          {editable ? (
            <>
              <input
                ref={thumbnailInput}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file, "thumbnail");
                }}
              />
              <Button type="button" variant="outline" disabled={busy} onClick={() => thumbnailInput.current?.click()}>
                <Upload className="size-4" aria-hidden />
                {thumbnailKey ? "Replace thumbnail" : "Upload thumbnail"}
              </Button>
            </>
          ) : null}
        </div>
        <p className="mt-3 text-[12px] text-zinc-400">
          Stored in a private bucket and served through an authenticated image route — the file is never
          publicly addressable.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Downloadable resources</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Optional. Learners who own this course get a short-lived signed link ({MAX_RESOURCE_MB} MB per file).
        </p>

        {resources.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-muted/40 px-4 py-6 text-center">
            <FileText className="mx-auto size-5 text-zinc-400" aria-hidden />
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              No resources yet. Worksheets, templates or starter code make a course more useful — but they are
              optional.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {resources.map((resource) => (
              <li key={resource.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="size-4 shrink-0 text-zinc-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{resource.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {resource.fileName} · {formatBytes(resource.sizeBytes)}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void download(resource.id)}>
                  <Download className="size-4" aria-hidden /> Download
                </Button>
                {editable ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete resource “${resource.title}”`}
                    title="Delete resource"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Delete “${resource.title}”?`)) return;
                      void deleteResource(resource.id, courseId)
                        .then((result) => !result.ok && setError(result.error ?? "Could not delete"))
                        .finally(() => router.refresh());
                    }}
                  >
                    <Trash2 className="size-4 text-red-600" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {editable ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              aria-label="Resource title"
              placeholder="Resource title (optional)"
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="max-w-xs"
            />
            <input
              ref={resourceInput}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file, "resource");
              }}
            />
            <Button type="button" disabled={busy} onClick={() => resourceInput.current?.click()}>
              <Upload className="size-4" aria-hidden /> Upload resource
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
