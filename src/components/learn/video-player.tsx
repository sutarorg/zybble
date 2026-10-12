"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Captions,
  CaptionsOff,
  Maximize,
  Pause,
  Play,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Fully simulated video player. No real video stream exists — a timer
 * advances a synthetic timeline so every control has a visible effect.
 */
export function SimulatedPlayer({
  thumbnail,
  title,
  durationMinutes,
  caption,
  playing,
  onPlayingChange,
  onEnded,
}: {
  thumbnail: string;
  title: string;
  durationMinutes: number;
  caption: string;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
}) {
  const total = Math.max(60, durationMinutes * 60);
  /* Timeline state carries the lesson it belongs to, so a new lesson starts at 0:00. */
  const [timeline, setTimeline] = useState<{ title: string; time: number }>({ title, time: 0 });
  const time = timeline.title === title ? timeline.time : 0;
  const setTime = (next: number) =>
    setTimeline((prev) => ({ title, time: typeof next === "number" ? next : prev.time }));
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [showCaptions, setShowCaptions] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const timeRef = useRef(0);

  // The lesson changed: start the clock again from the top.
  useEffect(() => {
    timeRef.current = 0;
  }, [title]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const next = Math.min(total, timeRef.current + dt * 8 * speed); // simulated 8x playback
      timeRef.current = next;
      setTime(next);
      if (next >= total) {
        onPlayingChange(false);
        onEnded();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, total]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const next = ratio * total;
    timeRef.current = next;
    setTime(next);
  };

  const toggleFullscreen = () => {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapRef.current.requestFullscreen?.();
    }
  };

  const pct = (time / total) * 100;

  return (
    <div
      ref={wrapRef}
      className="group/player relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 select-none"
      onDoubleClick={() => onPlayingChange(!playing)}
    >
      <Image
        src={thumbnail}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 900px"
        className={cn("object-cover transition-opacity duration-300", playing ? "opacity-60" : "opacity-45")}
        priority
      />
      <span className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/30" aria-hidden />

      {/* Simulated badge */}
      <span className="absolute top-3 left-3 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-white/80 uppercase backdrop-blur">
        Simulated player — no real video
      </span>

      {/* Caption bar */}
      {showCaptions && playing && (
        <span className="absolute bottom-16 left-1/2 max-w-[80%] -translate-x-1/2 rounded-md bg-zinc-950/80 px-3 py-1.5 text-center text-[13px] font-medium text-white backdrop-blur">
          {caption}
        </span>
      )}

      {/* Center play toggle */}
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => onPlayingChange(!playing)}
        className="absolute inset-0 flex cursor-pointer items-center justify-center outline-none"
      >
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-xl transition-all duration-200",
            playing ? "scale-90 opacity-0 group-hover/player:scale-100 group-hover/player:opacity-100" : "scale-100 opacity-100"
          )}
        >
          {playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
        </span>
      </button>

      {/* Control bar */}
      <div className="absolute right-0 bottom-0 left-0 px-3 pb-2.5 opacity-100 transition-opacity sm:px-4">
        {/* Timeline */}
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onClick={seek}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { timeRef.current = Math.min(total, timeRef.current + 10); setTime(timeRef.current); }
            if (e.key === "ArrowLeft") { timeRef.current = Math.max(0, timeRef.current - 10); setTime(timeRef.current); }
          }}
          className="group/timeline flex h-5 cursor-pointer items-center"
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/timeline:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute size-3 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/timeline:opacity-100"
            style={{ left: `calc(${pct}% - 6px)` }}
            aria-hidden
          />
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? "Pause" : "Play"}
            className="cursor-pointer rounded-md p-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            {playing ? <Pause className="size-4.5 fill-current" /> : <Play className="size-4.5 fill-current" />}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="cursor-pointer rounded-md p-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              {muted || volume === 0 ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setMuted(Number(e.target.value) === 0);
              }}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 group-hover/player:w-16 group-hover/player:opacity-100"
            />
          </div>

          <span className="ml-1 text-[11.5px] font-medium text-white/80 tabular-nums">
            {fmt(time)} <span className="text-white/50">/ {fmt(total)}</span>
          </span>

          <span className="ml-auto" />

          {/* Speed */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSpeedOpen((o) => !o)}
              aria-label="Playback speed"
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Settings2 className="size-4" aria-hidden />
              {speed}×
            </button>
            {speedOpen && (
              <div className="absolute right-0 bottom-9 w-24 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-pop">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSpeed(s);
                      setSpeedOpen(false);
                    }}
                    className={cn(
                      "w-full cursor-pointer px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-white/10",
                      s === speed ? "font-semibold text-primary" : "text-white/80"
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCaptions((c) => !c)}
            aria-label={showCaptions ? "Hide captions" : "Show captions"}
            aria-pressed={showCaptions}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors hover:bg-white/15",
              showCaptions ? "text-primary" : "text-white/70"
            )}
          >
            {showCaptions ? <Captions className="size-4.5" /> : <CaptionsOff className="size-4.5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="cursor-pointer rounded-md p-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Maximize className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
