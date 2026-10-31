"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Single-workspace preview. Creating additional workspaces is a Pro
 * (multi-seat) capability, exposed with an explanation rather than silently
 * dead or hidden.
 */
export function WorkspaceSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 shadow-xs transition hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white">
            P
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">
              Personal workspace
            </span>
            <span className="block text-xs text-slate-500">Free plan</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuItem>
          <span className="flex size-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-semibold text-white">
            P
          </span>
          Personal workspace
          <Check className="ml-auto size-4 !text-brand-600" aria-hidden />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between">
          <span className="flex items-center gap-2.5">
            <Plus className="size-4" aria-hidden />
            Create workspace
          </span>
          <Tooltip content="Multiple workspaces ship with Pro team collaboration — available when workspaces go live.">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Pro
            </span>
          </Tooltip>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
