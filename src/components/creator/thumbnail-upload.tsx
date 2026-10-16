"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imagePath } from "@/lib/image-path";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";

/** Uploads a course thumbnail to private file storage via a signed URL issued by /api/storage. */
export async function uploadThumbnail(courseId: string, file: File): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `Thumbnail must be ${MAX_IMAGE_MB} MB or smaller.` };
  const res = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", kind: "thumbnail", courseId, fileName: file.name, contentType: file.type, sizeBytes: file.size }) });
  if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; return { ok: false, error: b.error ?? "Could not start the upload." }; }
  const grant = (await res.json()) as { url: string };
  const put = await fetch(grant.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  return put.ok ? { ok: true } : { ok: false, error: "The upload could not be stored. Try again." };
}

export function ThumbnailUpload({ courseId, thumbnailKey, disabled, onFile }: { courseId?: string; thumbnailKey?: string | null; disabled?: boolean; onFile?: (file: File) => void }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const src = preview ?? (thumbnailKey ? imagePath("thumbnails", thumbnailKey) : null);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Course thumbnail" className="aspect-video w-44 rounded-xl border border-border object-cover shadow-card" />
        ) : (
          <div className="flex aspect-video w-44 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-accent/50 text-primary"><ImageIcon className="size-6" aria-hidden /><span className="text-[11px] font-medium">16:9 thumbnail</span></div>
        )}
        <div>
          <input ref={input} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
            setPreview(URL.createObjectURL(file));
            if (onFile) { onFile(file); return; }
            if (!courseId) return;
            setBusy(true); setError(null);
            const r = await uploadThumbnail(courseId, file); setBusy(false);
            if (!r.ok) setError(r.error ?? "Upload failed."); else router.refresh();
          }} />
          <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} {thumbnailKey || preview ? "Replace" : "Upload"}
          </Button>
          <p className="mt-2 text-[11.5px] text-zinc-400">JPEG, PNG or WebP · up to {MAX_IMAGE_MB} MB</p>
          {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
