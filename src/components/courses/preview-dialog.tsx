"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play, Expand } from "lucide-react";
import type { Course } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PREVIEW_SECONDS = 14;

/**
 * Simulated course-preview player. Honest demo behavior: an animated
 * "preview" plays (no real video file exists) with a working play/pause
 * control and progress bar.
 */
export function PreviewDialog({ course }: { course: Course }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now() - progress * PREVIEW_SECONDS * 1000;
    const tick = (now: number) => {
      const next = ((now - startRef.current) / 1000 / PREVIEW_SECONDS) % 1;
      setProgress(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const toggle = () => setPlaying((p) => !p);

  return (
    <>
      {/* Preview player directly in the page */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-zinc-950">
        <Image
          src={course.thumbnail}
          alt={`${course.title} preview`}
          fill
          sizes="(max-width: 1024px) 100vw, 768px"
          className={cn("object-cover opacity-95 transition-transform duration-300", playing ? "opacity-70" : "opacity-95")}
        />
        <span
          className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-transparent"
          aria-hidden
        />
        <span className="absolute top-3 left-3 flex items-center gap-2">
          <Badge variant="solid_white">Preview</Badge>
        </span>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="absolute inset-0 flex cursor-pointer items-center justify-center outline-none"
        >
          <span className={cn(
            "flex size-16 items-center justify-center rounded-full bg-white/95 text-foreground shadow-xl transition-all",
            playing ? "scale-90 opacity-0 hover:scale-100 hover:opacity-100" : "scale-100 opacity-100"
          )}>
            {playing ? (
              <Pause className="size-6 fill-current" aria-hidden />
            ) : (
              <Play className="ml-1 size-6 fill-current" aria-hidden />
            )}
          </span>
        </button>

        {/* Progress */}
        <span className="absolute right-0 bottom-0 left-0 p-3">
          <span className="block h-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full rounded-full bg-white"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
          <span className="mt-2 flex items-center justify-between text-[11.5px] font-medium text-white/80">
            <span>{course.title} — intro</span>
            <span>Simulated playback · demo</span>
          </span>
        </span>
      </div>

      {/* Fullscreen mode toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open fullscreen preview"
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white transition-colors hover:bg-white/30"
      >
        <Expand className="size-4" aria-hidden />
      </button>

      {/* Fullscreen Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{course.title} — course preview</DialogTitle>
          <div className="relative aspect-video w-full bg-zinc-950">
            <Image
              src={course.thumbnail}
              alt=""
              fill
              sizes="768px"
              className={cn("object-cover transition-opacity", playing ? "opacity-70" : "opacity-45")}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/30" aria-hidden />

            <span className="absolute top-4 left-4 flex items-center gap-2">
              <span className={cn("rounded-md px-2 py-1 text-[10.5px] font-bold tracking-wider uppercase", playing ? "bg-primary text-white" : "bg-white/90 text-foreground")}>
                {playing ? "Preview playing" : "Preview paused"}
              </span>
            </span>

            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause preview" : "Play preview"}
              className="absolute inset-0 flex cursor-pointer items-center justify-center outline-none"
            >
              <span className={cn(
                "flex size-16 items-center justify-center rounded-full bg-white/95 text-foreground shadow-xl transition-all",
                playing ? "scale-90 opacity-0 hover:scale-100 hover:opacity-100" : "scale-100 opacity-100"
              )}>
                {playing ? (
                  <Pause className="size-6 fill-current" aria-hidden />
                ) : (
                  <Play className="ml-1 size-6 fill-current" aria-hidden />
                )}
              </span>
            </button>

            {/* Progress */}
            <span className="absolute right-0 bottom-0 left-0 p-4">
              <span className="block h-1 overflow-hidden rounded-full bg-white/25">
                <span
                  className="block h-full rounded-full bg-white"
                  style={{ width: `${progress * 100}%` }}
                />
              </span>
              <span className="mt-2 flex items-center justify-between text-[11.5px] font-medium text-white/80">
                <span>{course.title} — intro</span>
                <span>Simulated playback · demo</span>
              </span>
            </span>
          </div>
          <div className="p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              This is a simulated preview for the demo. Enroll to access all{" "}
              <span className="font-medium text-foreground">{course.lessonsCount} lessons</span> — the free
              curriculum previews marked below are open to everyone.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
