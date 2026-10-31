"use client";

import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiPost, errorMessage } from "@/lib/api/client";
import { useLocalTimezone, useSession } from "@/lib/app/hooks";
import { TIMEZONE_OPTIONS } from "@/lib/app/timezones";

/**
 * First-time setup.
 *
 * `POST /api/auth/onboarding` runs `public.create_workspace`, so the workspace,
 * its owner membership, the subscription row and the usage counter all appear
 * together or not at all — there is no half-created workspace to clean up.
 * Visitors who already have a workspace are sent straight to the dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const session = useSession();
  const detectedTz = useLocalTimezone();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patches over the profile rather than a copy of it: no seeding effect, and a
  // session reload can never wipe what the user has typed.
  const name = nameDraft ?? session.data?.profile.name ?? "";
  const timezone = timezoneDraft ?? session.data?.profile.timezone ?? detectedTz;

  useEffect(() => {
    if (session.data && !session.data.requiresOnboarding) {
      router.replace("/dashboard");
    }
  }, [session.data, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await apiPost("/api/auth/onboarding", {
        workspaceName: workspaceName.trim(),
        timezone: timezone ?? detectedTz,
        fullName: name.trim() || undefined,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create your workspace."));
    } finally {
      setBusy(false);
    }
  }

  const resolvedTz = timezone ?? detectedTz;
  const tzOptions = TIMEZONE_OPTIONS.includes(resolvedTz)
    ? TIMEZONE_OPTIONS
    : [resolvedTz, ...TIMEZONE_OPTIONS];

  return (
    <>
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
          Set up your workspace
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          One workspace holds your LinkedIn accounts, calendar and team.
        </p>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200"
      >
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div>
          <label htmlFor="onboarding-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Your name
          </label>
          <Input
            id="onboarding-name"
            value={name}
            onChange={(event) => setNameDraft(event.target.value)}
            autoComplete="name"
            placeholder="Ada Okafor"
          />
        </div>

        <div>
          <label
            htmlFor="onboarding-workspace"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Workspace name
          </label>
          <Input
            id="onboarding-workspace"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Ada Okafor · Personal"
            maxLength={80}
            required
          />
          <p className="mt-1.5 text-[13px] text-slate-500">
            You can rename it later in workspace settings.
          </p>
        </div>

        <div>
          <label htmlFor="onboarding-tz" className="mb-1.5 block text-sm font-medium text-slate-700">
            Timezone
          </label>
          <Select value={resolvedTz} onValueChange={setTimezoneDraft}>
            <SelectTrigger id="onboarding-tz">
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
          <p className="mt-1.5 text-[13px] text-slate-500">
            Scheduled posts are stored as UTC instants and always shown in this zone, so daylight
            saving is handled for you.
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy || !workspaceName.trim()}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Create workspace
        </Button>

        <p className="text-center text-[13px] leading-5 text-slate-500">
          You start on Free: one LinkedIn account and 10 scheduled posts per month. No card needed.
        </p>
      </form>
    </>
  );
}
