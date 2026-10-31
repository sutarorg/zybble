"use client";

import { AlertTriangle, Info, KeyRound, Loader2, MonitorSmartphone, ShieldAlert, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { apiDelete, apiPatch, apiPost, errorMessage } from "@/lib/api/client";
import { useLocalTimezone, useSession } from "@/lib/app/hooks";
import { TIMEZONE_OPTIONS } from "@/lib/app/timezones";

/**
 * Account settings.
 *
 * Profile edits go to `PATCH /api/auth/profile`; the password reset is requested
 * from Supabase Auth (delivered by email) and account deletion is a real
 * erasure path guarded by password confirmation.
 */

export default function AccountSettingsPage() {
  const router = useRouter();
  const session = useSession();
  const detectedTz = useLocalTimezone();

  const profile = session.data?.profile ?? null;

  // The form is a patch over the loaded profile rather than a copy of it: no
  // seeding effect, and an unsaved edit is never clobbered by a reload.
  const [draft, setDraft] = useState<{ name?: string; timezone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const email = session.data?.user.email ?? "";

  const name = draft.name ?? profile?.name ?? "";
  const timezone = draft.timezone ?? profile?.timezone ?? detectedTz;
  const dirty =
    profile !== null &&
    ((draft.name !== undefined && draft.name !== (profile.name ?? "")) ||
      (draft.timezone !== undefined && draft.timezone !== profile.timezone));

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const result = await apiPatch<{ profile: { name: string | null; timezone: string } }>(
        "/api/auth/profile",
        { fullName: name, timezone },
      );
      setDraft({ name: result.profile.name ?? "", timezone: result.profile.timezone });
      setProfileNotice("Saved.");
      session.reload();
    } catch (error) {
      setProfileError(errorMessage(error, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function requestReset() {
    setResetBusy(true);
    try {
      await apiPost("/api/auth/password", { email, redirectTo: "/reset-password" });
      setResetSent(true);
    } catch (error) {
      setProfileError(errorMessage(error, "Could not send the reset link."));
    } finally {
      setResetBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiDelete("/api/auth/account", { password: deletePassword });
      router.replace("/signup?deleted=1");
      router.refresh();
    } catch (error) {
      setDeleteError(errorMessage(error, "Could not delete your account."));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="space-y-6">
        {/* Profile */}
        <section
          aria-labelledby="profile-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <h2 id="profile-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <UserRound className="size-4 text-brand-600" aria-hidden />
            Profile
          </h2>

          {session.loading || name === null ? (
            <div className="mt-5 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={(event) => void saveProfile(event)} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="acct-name">Full name</Label>
                  <Input
                    id="acct-name"
                    value={name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="acct-email">Email</Label>
                  <Input id="acct-email" type="email" value={email} disabled autoComplete="email" />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Email changes require re-verification, which is handled by Supabase Auth&rsquo;s
                    own flow — it is not editable here.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="acct-tz">Timezone</Label>
                <select
                  id="acct-tz"
                  value={timezone ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  {TIMEZONE_OPTIONS.includes(detectedTz) ? null : (
                    <option value={detectedTz}>{detectedTz} (detected)</option>
                  )}
                  {TIMEZONE_OPTIONS.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Used as the default for new posts and for grouping analytics days.
                </p>
              </div>

              {profileError && (
                <p role="alert" className="text-[13px] text-red-600">
                  {profileError}
                </p>
              )}

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={saving || !dirty}>
                  {saving && <Loader2 className="animate-spin" aria-hidden />}
                  Save profile
                </Button>
                {profileNotice && (
                  <p role="status" className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Info className="size-4 text-brand-500" aria-hidden />
                    {profileNotice}
                  </p>
                )}
              </div>
            </form>
          )}
        </section>

        {/* Security */}
        <section
          aria-labelledby="security-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <h2 id="security-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <KeyRound className="size-4 text-brand-600" aria-hidden />
            Security
          </h2>
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Password</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {resetSent
                    ? `If an account exists for ${email}, a reset link is on its way.`
                    : "We email a signed reset link — Zybble never stores or displays your password."}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={resetBusy || resetSent || email.length === 0}
                onClick={() => void requestReset()}
              >
                {resetBusy && <Loader2 className="animate-spin" aria-hidden />}
                {resetSent ? "Reset link sent" : "Send reset link"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MonitorSmartphone className="size-4 text-slate-500" aria-hidden />
                  Session
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Sessions live in httpOnly cookies and are refreshed on every request by the
                  server proxy.
                </p>
              </div>
              {session.loading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <p className="text-[13px] font-medium text-slate-500">
                  {session.data?.user.emailVerified
                    ? "Signed in · email verified"
                    : "Signed in · email not verified"}
                </p>
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
                Cancels billing, purges every workspace you own — posts, media, LinkedIn
                credentials and analytics history — and deletes your login. This cannot be undone.
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
                    Enter your current password to confirm. Active Pro subscriptions are cancelled at
                    the provider first, then every workspace you own is erased and your login is
                    deleted.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <Label htmlFor="delete-password">Current password</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                  {deleteError && (
                    <p role="alert" className="mt-2 text-[13px] text-red-600">
                      {deleteError}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="secondary" asChild>
                    <DialogClose>Keep my account</DialogClose>
                  </Button>
                  <Button
                    className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
                    disabled={deleteBusy || deletePassword.length === 0}
                    onClick={() => void deleteAccount()}
                  >
                    {deleteBusy && <Loader2 className="animate-spin" aria-hidden />}
                    <AlertTriangle aria-hidden />
                    Permanently delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </div>
    </div>
  );
}
