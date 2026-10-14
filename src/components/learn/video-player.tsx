"use client";

import * as React from "react";
import { Loader2, Lock, RefreshCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lesson video.
 *
 * Playback is authorised per request: the browser asks
 * `/api/learn/[lessonId]/playback`, which checks the learner's entitlement (or
 * the lesson's preview flag) and returns a short-lived Bunny Stream token URL.
 * A lesson id guessed in the URL therefore yields nothing.
 */
export function VideoPlayer({
  lessonId,
  title,
  hasVideo,
  videoReady,
  onEnded,
  onProgress,
}: {
  lessonId: string;
  title: string;
  /** Server-decided: entitled learners see video, others only previews. */
  hasVideo: boolean;
  /** True only when Bunny Stream has finished encoding. */
  videoReady: boolean;
  onEnded?: () => void;
  onProgress?: (seconds: number) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [state, setState] = React.useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; url: string }
    | { kind: "error"; message: string; retryable: boolean }
    | { kind: "locked" }
  >({ kind: "idle" });

  const load = React.useCallback(async () => {
    if (!hasVideo) {
      setState({ kind: "locked" });
      return;
    }
    if (!videoReady) {
      setState({ kind: "error", message: "This video is still being processed by Bunny Stream.", retryable: false });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/learn/${lessonId}/playback`, { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setState({
          kind: "error",
          message: payload.error ?? "This video is not available right now.",
          retryable: response.status >= 500,
        });
        return;
      }
      setState({ kind: "ready", url: payload.url });
    } catch {
      setState({ kind: "error", message: "Could not reach the video service.", retryable: true });
    }
  }, [lessonId, hasVideo, videoReady]);

  React.useEffect(() => {
    // Authorisation is an external system (the server), so this subscribes to
    // its response rather than computing it during render.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (state.kind === "locked") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted/60 text-center">
        <Lock className="size-7 text-zinc-400" aria-hidden />
        <p className="text-[14px] font-semibold">Enrol to watch this lesson</p>
        <p className="max-w-sm px-6 text-[12.5px] text-muted-foreground">
          Preview lessons are open to everyone. The rest need an active entitlement.
        </p>
      </div>
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-900" aria-busy>
        <Loader2 className="size-6 animate-spin text-white/70" aria-hidden />
        <span className="sr-only">Authorising playback</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-zinc-900 px-6 text-center">
        <TriangleAlert className="size-7 text-amber-400" aria-hidden />
        <p className="text-[14px] font-semibold text-white">{state.message}</p>
        {state.retryable ? (
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCcw aria-hidden /> Try again
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        key={state.url}
        src={state.url}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        preload="metadata"
        className={cn("size-full bg-black")}
        onEnded={onEnded}
        onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime)}
        aria-label={title}
      />
    </div>
  );
}