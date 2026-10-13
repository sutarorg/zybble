"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { Certificate } from "@/types";
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  ensureCertificateFonts,
  loadTemplateImage,
  paintCertificate,
} from "@/lib/certificate";
import { cn } from "@/lib/utils";

let cachedTemplate: HTMLImageElement | null = null;

/**
 * Paints the certificate into a real 1920×1080 (16:9) canvas that is scaled by
 * CSS. Because the on-screen preview and the downloaded PNG share the same
 * painter, what the learner sees is exactly what they download.
 */
export function CertificateCanvas({
  certificate,
  className,
}: {
  certificate: Certificate;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      await ensureCertificateFonts();
      if (!cachedTemplate) cachedTemplate = await loadTemplateImage();
      if (cancelled) return;
      paintCertificate(ctx, certificate, cachedTemplate);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [certificate]);

  return (
    <canvas
      ref={canvasRef}
      width={CERT_WIDTH}
      height={CERT_HEIGHT}
      role="img"
      aria-label={`Certificate of completion for ${certificate.courseTitle}, awarded to ${certificate.studentName}`}
      className={cn(
        "block h-auto w-full rounded-lg bg-[#fdfbf7] shadow-card transition-opacity",
        ready ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}
