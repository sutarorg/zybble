"use client";

import { Eye, ShieldCheck, Zap } from "lucide-react";
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

/**
 * Honest placeholder for LinkedIn OAuth: explains exactly what the flow will
 * do and that it ships with the backend release — no fake OAuth redirect.
 */
export function ConnectLinkedInDialog({ children }: { children: ReactNode }) {
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
            Connection happens through LinkedIn&rsquo;s official OAuth flow —
            here is exactly what that means before you start.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 space-y-3.5">
          {[
            {
              icon: ShieldCheck,
              text: "You authorise on linkedin.com. Zybble never sees or stores your LinkedIn password.",
            },
            {
              icon: Zap,
              text: "Zybble requests only publishing and profile-read scopes (e.g. w_member_social) — nothing more.",
            },
            {
              icon: Eye,
              text: "You can revoke access at any time, from LinkedIn's settings or from Zybble.",
            },
          ].map((row) => (
            <li key={row.text} className="flex gap-3">
              <row.icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <span className="text-sm leading-6 text-slate-600">{row.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <p className="text-[13px] leading-6 text-amber-900">
            <strong className="font-semibold">Not live yet.</strong> The OAuth
            handshake activates with the backend release. This screen documents
            the real flow so you know exactly what you&rsquo;re connecting to.
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" asChild className="sm:ml-auto">
            <DialogClose>Got it</DialogClose>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
