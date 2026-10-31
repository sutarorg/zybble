"use client";

import { Info, KeyRound, MonitorSmartphone, ShieldAlert, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { useClientMounted } from "@/lib/app/hooks";

export default function AccountSettingsPage() {
  const mounted = useClientMounted();
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setNotice("Profile changes will persist once authentication ships — nothing was stored.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="space-y-6">
        {/* Profile */}
        <section aria-labelledby="profile-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="profile-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <UserRound className="size-4 text-brand-600" aria-hidden />
            Profile
          </h2>
          <form onSubmit={onSaveProfile} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="acct-name">Full name</Label>
                <Input
                  id="acct-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="acct-email">Email</Label>
                <Input
                  id="acct-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Email changes require re-verification (enforced server-side when live).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit">Save profile</Button>
              {notice && (
                <p role="status" className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Info className="size-4 text-brand-500" aria-hidden />
                  {notice}
                </p>
              )}
            </div>
          </form>
        </section>

        {/* Security */}
        <section aria-labelledby="security-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="security-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <KeyRound className="size-4 text-brand-600" aria-hidden />
            Security
          </h2>
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Password</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Password management activates with authentication.
                </p>
              </div>
              <Tooltip content="No account exists yet — password changes arrive with the auth release.">
                <span>
                  <Button variant="secondary" disabled>Change password</Button>
                </span>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MonitorSmartphone className="size-4 text-slate-400" aria-hidden />
                  Active sessions
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Devices signed in to your account will be listed here.
                </p>
              </div>
              {!mounted ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <p className="text-[13px] font-medium text-slate-500">No active session</p>
              )}
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section aria-labelledby="danger-heading" className="rounded-2xl bg-white p-6 ring-1 ring-red-200">
          <h2 id="danger-heading" className="flex items-center gap-2 text-[15px] font-semibold text-red-700">
            <ShieldAlert className="size-4" aria-hidden />
            Danger zone
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Delete account</p>
              <p className="mt-0.5 max-w-md text-[13px] leading-5 text-slate-500">
                Permanently removes your account, workspaces, drafts and
                analytics history. Export first if you need a copy.
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="!ring-red-200 text-red-600 hover:!bg-red-50">
                  Delete account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    In the live product this permanently erases everything —
                    workspaces, scheduled posts and analytics history. Right now
                    no account exists, so there is nothing to delete: this
                    dialog is here so you can see exactly how destructive the
                    action is before the button means anything.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary" asChild>
                    <DialogClose>Keep my account</DialogClose>
                  </Button>
                  <Tooltip content="Nothing to delete — no account exists yet.">
                    <span>
                      <Button className="bg-red-300 text-white" disabled>
                        Permanently delete
                      </Button>
                    </span>
                  </Tooltip>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </div>
    </div>
  );
}
