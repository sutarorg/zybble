"use client";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/app/hooks";
import { useLocalTimezone } from "@/lib/app/hooks";
import { workspaceAllowance } from "@/features/billing/entitlements";
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

  /**
   * The cookie decides which workspace is current, not array order.
   *
   * This used to be `workspaces[0]`, which is why switching appeared to do
   * nothing: `listWorkspaces` orders by membership creation date, so once a
   * second workspace existed the switcher kept displaying the older one no
   * matter which was selected, and the check mark never moved.
   *
   * Falling back to the first workspace keeps a stale or deleted cookie from
   * leaving the control empty.
   */
  const current =
    workspaces.find((workspace) => workspace.id === session.data?.activeWorkspaceId) ??
    workspaces[0] ??
    null;

  // The cap is an account-wide allowance derived from the best plan held, not
  // a per-workspace counter. SQL enforces the same number, so this is only
  // here to avoid letting someone fill in a form that is guaranteed to fail.
  const workspaceLimit = workspaceAllowance(workspaces.map((workspace) => workspace.plan));
  const workspacesFull = workspaces.length >= workspaceLimit;

  const localTimezone = useLocalTimezone();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * Create a workspace, then move into it.
   *
   * Creating alone would leave the user looking at the workspace they were
   * already in, which reads as "nothing happened" — the switch is what makes
   * the action visible. The whole page reloads afterwards because every hook
   * reads the workspace from a cookie.
   */
  async function createAndSwitch() {
    const name = newName.trim();
    if (!name) {
      setCreateError("Give the workspace a name.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const { workspace } = await apiPost<{ workspace: { id: string } }>("/api/workspaces", {
        name,
        timezone: localTimezone,
      });

      await apiPost("/api/workspaces/switch", { workspaceId: workspace.id });

      setCreateOpen(false);
      setNewName("");
      router.refresh();
      window.location.reload();
    } catch (caught) {
      setCreateError(
        errorMessage(caught, "Could not create the workspace. Check the name and try again."),
      );
    } finally {
      setCreating(false);
    }
  }

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
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-semibold text-white">
              {(current.name.trim()[0] ?? "Z").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {current.name}
              </span>
              <span className="block text-xs text-slate-500">
                {current.plan === "pro" ? "Pro" : "Free"} plan
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-500" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        {/*
          Wider than the trigger on purpose. Matching the trigger's width left
          every row cramped, and a second line would not fit at all. The cap
          keeps it inside a narrow phone viewport.
        */}
        <DropdownMenuContent
          align="start"
          className="w-[17.5rem] max-w-[calc(100vw-2rem)] p-1.5"
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>Workspaces</span>
            {/* The count lives here rather than on the trigger: it belongs to
                the list, and the trigger reads better without it. */}
            <span className="text-[11px] font-normal tabular-nums text-slate-400">
              {workspaces.length} of {workspaceLimit}
            </span>
          </DropdownMenuLabel>

          <div className="mt-1 space-y-0.5">
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => void switchTo(workspace)}
                disabled={pending !== null}
                className="gap-3 px-2 py-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-semibold text-white">
                  {(workspace.name.trim()[0] ?? "Z").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-5 text-slate-900">
                    {workspace.name}
                  </span>
                  <span className="block text-[11px] leading-4 text-slate-500">
                    {workspace.plan === "pro" ? "Pro" : "Free"} plan
                  </span>
                </span>
                {pending === workspace.id ? (
                  <Loader2 className="ml-auto size-4 animate-spin" aria-hidden />
                ) : (
                  workspace.id === current.id && (
                    <Check className="ml-auto size-4 !text-brand-600" aria-hidden />
                  )
                )}
              </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator />

          {workspacesFull && (
            <p className="px-2 pb-1.5 text-[11px] leading-4 text-slate-500">
              {workspaceLimit === 1
                ? "The Free plan includes one workspace. Pro allows three."
                : "All three Pro workspaces are in use."}
            </p>
          )}

          <DropdownMenuItem
            disabled={workspacesFull}
            onSelect={(event) => {
              // Let the dialog take focus before the menu unmounts, otherwise
              // Radix restores focus to a trigger that no longer exists.
              event.preventDefault();
              setCreateOpen(true);
            }}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Plus className="size-4" aria-hidden />
            </span>
            <span className="text-[13px]">Create workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="mt-1.5 px-1 text-[11px] text-red-600">
          {error}
        </p>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName("");
            setCreateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A workspace keeps LinkedIn accounts, drafts and analytics to itself. You can switch
              between them whenever you like. This account can hold {workspaceLimit}{" "}
              {workspaceLimit === 1 ? "workspace" : "workspaces"} on the{" "}
              {workspaceLimit > 1 ? "Pro" : "Free"} plan.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createAndSwitch();
            }}
            className="mt-2 space-y-4"
          >
            <div>
              <label
                htmlFor="new-workspace-name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Workspace name
              </label>
              <Input
                id="new-workspace-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Acme · Personal"
                maxLength={80}
                autoFocus
              />
              <p className="mt-1.5 text-[13px] text-slate-500">
                Timezone is set to {localTimezone}. Both can be changed later in workspace settings.
              </p>
            </div>

            {createError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
              >
                {createError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || newName.trim().length === 0}>
                {creating && <Loader2 className="animate-spin" aria-hidden />}
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
