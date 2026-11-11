"use client";

import { AlertTriangle, Eye, ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { LinkedinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLinkedInAccounts } from "@/lib/app/hooks";

/**
 * LinkedIn connect dialog.
 *
 * Explains the real flow and then hands the browser to
 * `GET /api/linkedin/connect`, which is where the CSRF `state` is generated and
 * stored (hashed) server-side — not in the client. The scopes listed are the
 * ones the server will actually request for this deployment, so the dialog
 * never promises analytics access the app has not been granted.
 */
export function ConnectLinkedInDialog({ children }: { children: ReactNode }) {
  const accounts = useLinkedInAccounts();
  const capabilities = accounts.data?.capabilities ?? null;

  const scopes = capabilities?.scopes ?? ["w_member_social"];
  const configured = capabilities?.configured ?? true;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-[#0A66C2] ring-1 ring-brand-100">
            <LinkedinIcon className="size-5" />
          </span>
          <DialogTitle className="pt-3">Connect LinkedIn to Zybble</DialogTitle>
          <DialogDescription>
            You approve the connection on linkedin.com, then come straight back.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 space-y-3">
          {[
            {
              icon: ShieldCheck,
              text: "Approved on linkedin.com — Zybble never sees your password.",
            },
            {
              icon: Zap,
              text: `Only these scopes are requested: ${scopes.join(", ")}.`,
            },
            {
              icon: Eye,
              text: "Tokens are AES-256-GCM encrypted and decrypted only server-side.",
            },
          ].map((row) => (
            <li key={row.text} className="flex gap-3">
              <row.icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <span className="text-[13px] leading-5 text-slate-600">{row.text}</span>
            </li>
          ))}
        </ul>

        {!configured && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
            <p className="flex items-start gap-2 text-[13px] leading-6 text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              LinkedIn credentials are not configured, so connecting is disabled. Add{" "}
              <code className="font-mono text-[12px]">LINKEDIN_CLIENT_ID</code> and{" "}
              <code className="font-mono text-[12px]">LINKEDIN_CLIENT_SECRET</code> to the server
              environment.
            </p>
          </div>
        )}

        {configured && capabilities !== null && !capabilities.analytics && (
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <p className="text-[13px] leading-6 text-slate-600">
              <strong className="font-semibold">Analytics unavailable.</strong> Post analytics need{" "}
              <code className="font-mono text-[12px]">r_member_postAnalytics</code>, which LinkedIn
              grants only to approved apps. Publishing is unaffected — Zybble never estimates
              numbers.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" asChild>
            <DialogClose>Cancel</DialogClose>
          </Button>
          <Button
            asChild
            className="bg-[#0A66C2] text-white hover:bg-[#004182] active:bg-[#004182]"
            aria-disabled={!configured}
          >
            <a
              href="/api/linkedin/connect"
              className={configured ? undefined : "pointer-events-none opacity-50"}
            >
              {accounts.loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <LinkedinIcon className="size-4" />
              )}
              Continue to LinkedIn
              <ExternalLink aria-hidden />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
