"use client";

import { AlertTriangle } from "lucide-react";
import { PostComposer } from "@/components/app/post-composer";
import { useLinkedInAccounts, useUsage } from "@/lib/app/hooks";
import type { DashboardPost } from "@/lib/app/types";

/**
 * Loads the two things the composer needs before it can save anything real —
 * the accounts that are allowed to publish, and the workspace's remaining
 * scheduled-post quota — then renders the composer.
 *
 * Both come from `/api/*`, so the composer never guesses an entitlement and
 * never shows a post as saved when the plan would have refused it.
 */
export function PostComposerWithContext({
  initialPost,
  initialDate,
}: {
  initialPost?: DashboardPost;
  initialDate?: string;
}) {
  const accounts = useLinkedInAccounts();
  const usage = useUsage();

  const loading = accounts.loading || usage.loading;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-64 rounded-2xl bg-white ring-1 ring-slate-200" />
        <div className="h-56 rounded-2xl bg-white ring-1 ring-slate-200" />
      </div>
    );
  }

  if (accounts.error || usage.error) {
    return (
      <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-red-900">The composer could not load.</p>
          <p className="mt-1 text-[13px] leading-6 text-red-800">
            {accounts.error ?? usage.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PostComposer
      initialPost={initialPost}
      initialDate={initialDate}
      accounts={accounts.data?.connections ?? []}
      remainingScheduleSlots={usage.data?.remaining ?? null}
    />
  );
}
