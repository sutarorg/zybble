"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);
const ALLOWED_VIDEO_EXTS = new Set(["mp4", "mov", "webm", "m4v"]);
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function validateVideoFileClient(file: File): string | null {
  if (file.size <= 0) return "The selected video file is empty.";
  if (file.size > MAX_VIDEO_BYTES)
    return "Video file exceeds the 2 GB maximum upload limit.";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const validMime = ALLOWED_VIDEO_MIMES.has(file.type.toLowerCase());
  const validExt = ALLOWED_VIDEO_EXTS.has(ext);
  if (!validMime && !validExt) {
    return "Unsupported video format. Please choose an MP4, MOV, WebM, or M4V video file.";
  }
  return null;
}

export function formatVideoBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function tusUploadVideo(
  endpoint: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  const createRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": `filename ${btoa(
        unescape(encodeURIComponent(file.name))
      )},filetype ${btoa(file.type || "video/mp4")}`,
    },
  });
  const location = createRes.headers.get("Location");
  if (!createRes.ok || !location) {
    throw new Error("Could not initialize video upload session.");
  }

  const uploadUrl = new URL(location, endpoint).toString();
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", uploadUrl);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Tus-Resumable", "1.0.0");
    xhr.setRequestHeader("Upload-Offset", "0");
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress((ev.loaded / ev.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Video upload failed (${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error("Network error while uploading video."));
    xhr.send(file);
  });
}

interface VideoLessonPanelProps {
  lessonId: string;
  hasVideo: boolean;
  videoStatus: string | null;
  playbackReady: boolean;
  disabled?: boolean;
  onStatusRefresh: () => Promise<void>;
  onVideoUploaded: () => Promise<void>;
  onDetectedDurationMinutes?: (minutes: number) => void;
}

export function VideoLessonPanel({
  lessonId,
  hasVideo,
  videoStatus,
  playbackReady,
  disabled = false,
  onStatusRefresh,
  onVideoUploaded,
  onDetectedDurationMinutes,
}: VideoLessonPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const localVideoUrlRef = React.useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(
    null
  );
  const [detectedSeconds, setDetectedSeconds] = React.useState<number | null>(
    null
  );
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [refreshingStatus, setRefreshingStatus] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const [showHostedPreview, setShowHostedPreview] = React.useState(false);
  const [hostedEmbedUrl, setHostedEmbedUrl] = React.useState<string | null>(
    null
  );
  const [loadingHostedPreview, setLoadingHostedPreview] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current);
      }
    };
  }, []);

  function handlePickFile(file: File | null) {
    if (disabled) return;
    setError(null);
    setSuccessMsg(null);
    if (!file) return;

    const validationError = validateVideoFileClient(file);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (localVideoUrlRef.current) {
      URL.revokeObjectURL(localVideoUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    localVideoUrlRef.current = url;
    setSelectedFile(file);
    setLocalPreviewUrl(url);
    setDetectedSeconds(null);
  }

  async function handleStartUpload() {
    if (!selectedFile || disabled) {
      setError("Select a video file to upload first.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccessMsg(null);

    try {
      const grantRes = await fetch("/api/media/video/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          fileName: selectedFile.name,
          contentType: selectedFile.type || "video/mp4",
          sizeBytes: selectedFile.size,
        }),
      });
      const grantData = (await grantRes.json().catch(() => ({}))) as {
        error?: string;
        endpoint?: string;
        tusEndpoint?: string;
        signature?: string;
        expiration?: number;
        videoId?: string;
        libraryId?: string;
        headers?: Record<string, string>;
      };

      if (!grantRes.ok) {
        setError(grantData.error ?? "Could not start the video upload.");
        return;
      }

      const endpoint =
        grantData.tusEndpoint ??
        grantData.endpoint ??
        "https://video.bunnycdn.com/tusupload";
      const headers =
        grantData.headers ??
        ({
          AuthorizationSignature: String(grantData.signature ?? ""),
          AuthorizationExpire: String(grantData.expiration ?? ""),
          VideoId: String(grantData.videoId ?? ""),
          LibraryId: String(grantData.libraryId ?? ""),
        } satisfies Record<string, string>);

      await tusUploadVideo(endpoint, headers, selectedFile, (pct) =>
        setProgress(Math.round(pct))
      );

      setSuccessMsg(
        "Video uploaded! Bunny Stream is now encoding it for adaptive playback."
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onVideoUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleCheckStatus() {
    setRefreshingStatus(true);
    setError(null);
    try {
      await onStatusRefresh();
    } finally {
      setRefreshingStatus(false);
    }
  }

  async function handleToggleHostedPreview() {
    if (showHostedPreview) {
      setShowHostedPreview(false);
      return;
    }
    setLoadingHostedPreview(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/${lessonId}/playback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !payload.url) {
        setError(payload.error ?? "Could not load video preview.");
        return;
      }
      setHostedEmbedUrl(payload.url);
      setShowHostedPreview(true);
    } catch {
      setError("Could not load video preview.");
    } finally {
      setLoadingHostedPreview(false);
    }
  }

  const isFailed = videoStatus === "failed";
  const isEncoding = hasVideo && !playbackReady && !isFailed;

  return (
    <div className="space-y-3.5 rounded-xl border border-border bg-white p-4">
      {/* Header: Video Source & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
            <Video className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[13px] font-semibold text-foreground">
                Lesson video source
              </h4>
              {playbackReady ? (
                <Badge variant="emerald">Ready to stream</Badge>
              ) : isEncoding ? (
                <Badge variant="amber">
                  Encoding ({videoStatus ?? "processing"})
                </Badge>
              ) : isFailed ? (
                <Badge variant="amber">Encoding failed</Badge>
              ) : (
                <Badge variant="outline">No video uploaded yet</Badge>
              )}
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Supported formats: MP4, MOV, WebM, M4V · Up to 2 GB · Adaptive HLS streaming via Bunny Stream
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {playbackReady ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingHostedPreview}
              onClick={() => void handleToggleHostedPreview()}
            >
              {loadingHostedPreview ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-3.5 text-emerald-600" aria-hidden="true" />
              )}
              {showHostedPreview
                ? "Hide video preview"
                : "Preview uploaded video"}
            </Button>
          ) : null}

          {isEncoding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshingStatus}
              onClick={() => void handleCheckStatus()}
            >
              <RefreshCw
                className={cn("size-3.5", refreshingStatus && "animate-spin")}
                aria-hidden="true"
              />
              Check encoding status
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
        >
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {successMsg ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800"
        >
          <CheckCircle2
            className="size-3.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>{successMsg}</span>
        </div>
      ) : null}

      {/* Hosted Bunny Stream video preview when toggled */}
      {showHostedPreview && hostedEmbedUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <div className="aspect-video w-full">
            <iframe
              src={hostedEmbedUrl}
              title="Uploaded lesson video preview"
              className="h-full w-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      {/* Local file preview & upload staging when a file is chosen */}
      {selectedFile && localPreviewUrl ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-accent/30 p-3.5">
          <div className="grid gap-3.5 sm:grid-cols-[240px_1fr] sm:items-center">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
              <video
                src={localPreviewUrl}
                controls
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const secs = Math.round(e.currentTarget.duration || 0);
                  if (secs > 0) {
                    setDetectedSeconds(secs);
                    onDetectedDurationMinutes?.(Math.max(1, Math.round(secs / 60)));
                  }
                }}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {selectedFile.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span>{formatVideoBytes(selectedFile.size)}</span>
                    {detectedSeconds ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {Math.max(1, Math.round(detectedSeconds / 60))} min detected
                      </span>
                    ) : null}
                  </div>
                </div>
                {!uploading ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setLocalPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Clear selected video file"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              {uploading && progress !== null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px] font-medium text-primary">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Uploading video to Bunny Stream…
                    </span>
                    <span className="font-mono font-semibold">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploading}
                    onClick={() => void handleStartUpload()}
                  >
                    <Upload className="size-3.5" aria-hidden="true" />
                    {hasVideo ? "Confirm & replace video" : "Start video upload"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose a different file
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone / Upload Trigger */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) handlePickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => !uploading && !disabled && fileInputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading && !disabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={
            hasVideo ? "Replace lesson video file" : "Select lesson video file"
          }
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex-row sm:justify-between sm:text-left",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
            dragging
              ? "border-primary bg-accent/60"
              : "border-zinc-300 bg-zinc-50/60 hover:border-primary/40 hover:bg-accent/30"
          )}
        >
          <div className="flex flex-col items-center gap-2.5 sm:flex-row">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-primary shadow-2xs">
              <Film className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12.5px] font-medium text-foreground">
                {playbackReady
                  ? "Video is encoded and ready for learners — click or drop a file here to replace it"
                  : isEncoding
                    ? "Video is currently encoding on Bunny Stream — you can upload a replacement if needed"
                    : "Drop an MP4, MOV, WebM, or M4V video here, or click to browse"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                1080p (1920 × 1080) recommended · Duration is detected automatically from your file
              </p>
            </div>
          </div>

          {!disabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="shrink-0 gap-1.5"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {hasVideo ? "Replace video" : "Choose video file"}
            </Button>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
        className="hidden"
        onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
