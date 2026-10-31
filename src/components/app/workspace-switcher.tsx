"use client";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiPost, errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/app/hooks";
import type { Workspace } from "@/lib/app/types";

/**
 * Workspace switcher.
 *
 * Lists the workspaces the caller is actually a member of (from
 * `/api/auth/session`) and switches by asking the server to set the
 * `zybble_workspace` cookie — the server re-checks membership before writing it.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const session = useSession();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaces = session.data?.workspaces ?? [];
  const current = workspaces[0] ?? null;

  async function switchTo(workspace: Workspace) {
    if (workspace.id === current?.id) return;

    setPending(workspace.id);
    setError(null);

    try {
      await apiPost("/api/workspaces/switch", { workspaceId: workspace.id });
      // Every hook reads the workspace from that cookie, so the whole app has
      // to be re-rendered rather than just this menu.
      router.refresh();
      window.location.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not switch workspace."));
    } finally {
      setPending(null);
    }
  }

  if (session.loading) {
    return <div className="h-[46px] animate-pulse rounded-xl bg-white ring-1 ring-slate-200" />;
  }

  if (session.error || current === null) {
    return (
      <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">
          {session.error ?? "No workspace yet — finish onboarding to create one."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 shadow-xs transition hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white">
              {(current.name.trim()[0] ?? "Z").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {current.name}
              </span>
              <span className="block text-xs text-slate-500">
                {current.plan === "pro" ? "Pro" : "Free"} plan
                {workspaces.length > 1 ? ` · ${workspaces.length} workspaces` : ""}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => void switchTo(workspace)}
              disabled={pending !== null}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-semibold text-white">
                {(workspace.name.trim()[0] ?? "Z").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {pending === workspace.id ? (
                <Loader2 className="ml-auto size-4 animate-spin" aria-hidden />
              ) : (
                workspace.id === current.id && (
                  <Check className="ml-auto size-4 !text-brand-600" aria-hidden />
                )
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings/account">
              <Plus className="size-4" aria-hidden />
              Create workspace
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="mt-1.5 px-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
