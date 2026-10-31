"use client";

import { AlertTriangle, Bell, Info, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiPatch, errorMessage } from "@/lib/api/client";
import { useApiResource, useLocalTimezone } from "@/lib/app/hooks";
import type { NotificationPreferences, PlanId } from "@/lib/app/types";
import { TIMEZONE_OPTIONS } from "@/lib/app/timezones";

/**
 * Workspace settings.
 *
 * Name and timezone write to `PATCH /api/workspaces/current` (admin only);
 * notification switches write to `/api/notifications/preferences`, which the
 * email sender reads before every send — so turning one off really stops the
 * email, it does not just grey out a checkbox.
 */

type WorkspaceState = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: PlanId;
    seats: number;
    timezone: string;
    createdAt: string;
  };
  role: string;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_post_published: true,
  email_post_failed: true,
  email_post_reminder: false,
  email_token_expiring: true,
  email_billing: true,
  email_product_updates: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

const NOTIFICATION_OPTIONS = [
  {
    id: "email_post_published" as const,
    label: "Post published",
    description: "When a scheduled post goes live on LinkedIn.",
  },
  {
    id: "email_post_failed" as const,
    label: "Publishing failed",
    description: "Retries, expired tokens and LinkedIn API errors.",
  },
  {
    id: "email_post_reminder" as const,
    label: "Scheduled-post reminder",
    description: "A short note before a queued post goes out.",
  },
  {
    id: "email_token_expiring" as const,
    label: "LinkedIn reconnection needed",
    description: "When a connection is about to expire or has been revoked.",
  },
  {
    id: "email_billing" as const,
    label: "Billing receipts and failures",
    description: "Payment confirmations, failed charges and cancellations.",
  },
] as const;

export default function WorkspaceSettingsPage() {
  const detectedTz = useLocalTimezone();
  const workspace = useApiResource<WorkspaceState>("/api/workspaces/current");
  const preferences = useApiResource<{ preferences: NotificationPreferences }>(
    "/api/notifications/preferences",
  );

  const [name, setName] = useState<string | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [switches, setSwitches] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace.data) return;
    setName((current) => current ?? workspace.data!.workspace.name);
    setTz((current) => current ?? workspace.data!.workspace.timezone);
  }, [workspace.data]);

  useEffect(() => {
    if (!preferences.data) return;
    setSwitches((current) => current ?? { ...DEFAULT_PREFERENCES, ...preferences.data!.preferences });
  }, [preferences.data]);

  const canManage = workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const resolvedTz = tz ?? detectedTz;
  const loading = workspace.loading || preferences.loading;

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (canManage && name !== null && tz !== null) {
        await apiPatch("/api/workspaces/current", { name, timezone: tz });
      }
      if (switches !== null) {
        await apiPatch("/api/notifications/preferences", switches);
      }
      setNotice("Saved.");
      workspace.reload();
      preferences.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not save your settings."));
    } finally {
      setSaving(false);
    }
  }

  if (loading || name === null || tz === null || switches === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <SettingsNav />
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const tzOptions = TIMEZONE_OPTIONS.includes(resolvedTz)
    ? TIMEZONE_OPTIONS
    : [resolvedTz, ...TIMEZONE_OPTIONS];

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />

      <form onSubmit={(event) => void onSave(event)} className="space-y-6">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-800 ring-1 ring-red-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* Workspace identity */}
        <section
          aria-labelledby="ws-identity"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <h2 id="ws-identity" className="text-[15px] font-semibold text-slate-900">
            Workspace
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            How this workspace appears to you and your team.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                disabled={!canManage}
              />
            </div>
            <div>
              <Label htmlFor="ws-tz">Default timezone</Label>
              <Select value={resolvedTz} onValueChange={setTz} disabled={!canManage}>
                <SelectTrigger id="ws-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tzOptions.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone === detectedTz ? `${zone} (detected)` : zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-slate-400">
                Used as the scheduling default and to group analytics days.
              </p>
            </div>
          </div>
          {!canManage && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-100">
              Only owners and admins can rename the workspace or change its timezone.
            </p>
          )}
        </section>

        {/* Notifications */}
        <section
          aria-labelledby="ws-notifications"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <h2
            id="ws-notifications"
            className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"
          >
            <Bell className="size-4 text-brand-600" aria-hidden />
            Email notifications
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These preferences are checked before every send, so switching one off really stops that
            email.
          </p>
          <ul className="mt-5 divide-y divide-slate-100">
            {NOTIFICATION_OPTIONS.map((option) => (
              <li
                key={option.id}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <Label
                    htmlFor={`notif-${option.id}`}
                    className="!mb-0 text-sm font-medium text-slate-800"
                  >
                    {option.label}
                  </Label>
                  <p className="mt-0.5 text-[13px] text-slate-500">{option.description}</p>
                </div>
                <Switch
                  id={`notif-${option.id}`}
                  checked={switches[option.id]}
                  onCheckedChange={(checked) =>
                    setSwitches((previous) =>
                      previous ? { ...previous, [option.id]: checked } : previous,
                    )
                  }
                  aria-label={option.label}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Save preferences
          </Button>
          {notice && (
            <p role="status" className="flex items-start gap-1.5 text-sm leading-6 text-slate-500">
              <Info className="mt-1 size-4 shrink-0 text-brand-500" aria-hidden />
              {notice}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
