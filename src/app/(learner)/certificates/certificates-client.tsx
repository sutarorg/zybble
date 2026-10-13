"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Award, Compass, Download, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import type { Certificate } from "@/types";
import { useApp } from "@/components/providers/app-providers";
import { CertificateCanvas } from "@/components/certificate/certificate-canvas";
import {
  downloadCertificate,
  formatCertificateDate,
  formatCertificateDuration,
} from "@/lib/certificate";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function CertificatesClient() {
  const translateUi = useTranslate();
  const { hydrated, certificates } = useApp();
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...certificates].sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt)),
    [certificates]
  );

  const save = async (certificate: Certificate) => {
    if (busyId) return;
    setBusyId(certificate.id);
    try {
      await downloadCertificate(certificate);
      toast.success("Certificate downloaded");
    } catch {
      toast.error("Could not generate the certificate file");
    } finally {
      setBusyId(null);
    }
  };

  if (!hydrated) {
    return (
      <div className="page-container py-6 sm:py-8" aria-busy>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-9 w-64" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-6 sm:py-8">
      <Breadcrumb items={[{ label: "Overview", href: "/dashboard" }, { label: "Certificates" }]} />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Your achievements"} /></p>
          <h1 className="font-display mt-2 text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]"><LocalizedText text={"Certificates"} /></h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground"><LocalizedText text={"Every course you finish earns a personalised certificate. Open one to preview it, or download the full-resolution PNG to share. Certificates are saved on this device only; certificate IDs are not publicly verifiable in this preview."} /></p>
        </div>
        {sorted.length > 0 && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700">
            {sorted.length}<LocalizedText text={"earned"} /></span>
        )}
      </header>

      {sorted.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white text-zinc-300 shadow-card">
            <Award className="size-6" aria-hidden />
          </span>
          <h2 className="font-display text-[17px] font-semibold tracking-tight"><LocalizedText text={"No certificates yet"} /></h2>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-muted-foreground"><LocalizedText text={"Finish every lesson in a course and your certificate appears here automatically — ready to download."} /></p>
          <Button asChild className="mt-2">
            <Link href="/">
              <Compass aria-hidden /><LocalizedText text={"Find a course"} /></Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {sorted.map((certificate) => (
            <li
              key={certificate.id}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-card transition-all hover:border-violet-200 hover:shadow-card-hover"
            >
              <button
                type="button"
                onClick={() => setSelected(certificate)}
                className="block w-full cursor-pointer p-2.5 text-left"
                aria-label={translateUi(`Open certificate for ${certificate.courseTitle}`)}
              >
                <CertificateCanvas certificate={certificate} />
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">
                    <LocalizedText text={certificate.courseTitle} />
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground"><LocalizedText text={"Issued"} /><LocalizedText text={formatCertificateDate(certificate.issuedAt)} /> ·<LocalizedText text={" "} />
                    <LocalizedText text={certificate.instructorName} />
                    {<LocalizedText text={formatCertificateDuration(certificate.durationMinutes)
                      ? ` · ${formatCertificateDuration(certificate.durationMinutes)}`
                      : ""} />}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                    <LockKeyhole className="size-3" aria-hidden /><LocalizedText text={"Certificate ID"} /><LocalizedText text={certificate.id} />
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => save(certificate)}
                  disabled={busyId === certificate.id}
                >
                  {busyId === certificate.id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Download aria-hidden />
                  )}<LocalizedText text={"Download"} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl gap-5 p-5 sm:p-6" aria-describedby={undefined}>
          <div>
            <DialogTitle className="font-display text-xl">{selected?.courseTitle}</DialogTitle>
            <DialogDescription className="mt-1"><LocalizedText text={"Awarded to"} />{selected?.studentName}<LocalizedText text={"· issued"} /><LocalizedText text={" "} />
              <LocalizedText text={selected ? formatCertificateDate(selected.issuedAt) : ""} />
            </DialogDescription>
          </div>
          {selected && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2 sm:p-3">
              <CertificateCanvas certificate={selected} />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={!selected || busyId === selected.id}
              onClick={() => selected && save(selected)}
            >
              {selected && busyId === selected.id ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Download aria-hidden />
              )}<LocalizedText text={"Download PNG"} /></Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setSelected(null)}
            ><LocalizedText text={"Close"} /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
