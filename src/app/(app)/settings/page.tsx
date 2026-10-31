"use client";

import { Bell, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocalTimezone } from "@/lib/app/hooks";

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const NOTIFICATION_OPTIONS = [
  { id: "publish_success", label: "Post published", description: "When a scheduled post goes live on LinkedIn." },
  { id: "publish_failed", label: "Publishing failed", description: "Retries, token problems or LinkedIn API errors." },
  { id: "weekly_digest", label: "Weekly performance digest", description: "One email on Mondays with the week's essentials." },
] as const;

export default function WorkspaceSettingsPage() {
  const detectedTz = useLocalTimezone();
  const [name, setName] = useState("Personal workspace");
  const [tz, setTz] = useState("");
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    publish_success: true,
    publish_failed: true,
    weekly_digest: false,
  });
  const [notice, setNotice] = useState<string | null>(null);

  const resolvedTz = tz || detectedTz;
  const tzOptions = TIMEZONES.includes(resolvedTz) ? TIMEZONES : [resolvedTz, ...TIMEZONES];

  function onSave(e: FormEvent) {
    e.preventDefault();
    // Frontend phase: persist nothing, say so plainly.
    setNotice(
      "Interface validated — workspace settings will persist to your account once the backend ships. Nothing was stored.",
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />

      <form onSubmit={onSave} className="space-y-6">
        {/* Workspace identity */}
        <section aria-labelledby="ws-identity" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="ws-identity" className="text-[15px] font-semibold text-slate-900">Workspace</h2>
          <p className="mt-1 text-sm text-slate-500">How this workspace appears to you and your team.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="ws-tz">Default timezone</Label>
              <Select value={resolvedTz} onValueChange={setTz}>
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
              <p className="mt-1.5 text-xs text-slate-400">Used for scheduling defaults and digests.</p>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section aria-labelledby="ws-notifications" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="ws-notifications" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Bell className="size-4 text-brand-600" aria-hidden />
            Notifications
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose what Zybble emails you about. Delivery begins when email service (Resend) is connected.
          </p>
          <ul className="mt-5 divide-y divide-slate-100">
            {NOTIFICATION_OPTIONS.map((opt) => (
              <li key={opt.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <Label htmlFor={`notif-${opt.id}`} className="!mb-0 text-sm font-medium text-slate-800">
                    {opt.label}
                  </Label>
                  <p className="mt-0.5 text-[13px] text-slate-500">{opt.description}</p>
                </div>
                <Switch
                  id={`notif-${opt.id}`}
                  checked={notifications[opt.id]}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, [opt.id]: checked }))
                  }
                  aria-label={opt.label}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit" size="lg">Save preferences</Button>
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
