"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { Award, Download, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import type { Certificate } from "@/types";
import { downloadCertificate } from "@/lib/certificate";
import { CertificateCanvas } from "@/components/certificate/certificate-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Completion celebration: shows the earned certificate and lets the learner save it. */
export function CertificateDialog({
  certificate,
  open,
  onOpenChange,
  title = "Course completed!",
  description,
}: {
  certificate: Certificate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!certificate || busy) return;
    setBusy(true);
    try {
      await downloadCertificate(certificate);
      toast.success("Certificate downloaded");
    } catch {
      toast.error("Could not generate the certificate file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open && Boolean(certificate)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-5 p-5 sm:p-6" aria-describedby={undefined}>
        <div className="flex items-start gap-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" aria-hidden />
            <Award className="relative size-6 text-emerald-600" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl">{title}</DialogTitle>
            <DialogDescription className="mt-1">
              {description ??
                "Every lesson is done. Your certificate is ready — download it or find it any time under Certificates."}
            </DialogDescription>
          </div>
        </div>

        {certificate && (
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2 sm:p-3">
            <CertificateCanvas certificate={certificate} />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={save} disabled={busy || !certificate}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Preparing…" : "Download certificate"}
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/certificates">
              <PartyPopper aria-hidden />
              All my certificates
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Keep reviewing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
