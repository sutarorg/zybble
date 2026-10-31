"use client";

import { CreditCard, LogIn, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Account menu. No session exists in this frontend phase, so the menu is
 * honestly labelled as a preview and offers the real entry points.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <UserRound className="size-4.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                Preview account
              </span>
              <span className="block truncate text-xs text-slate-500">
                Sign-in ships with the backend
              </span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/settings/account">
            <Settings aria-hidden />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <CreditCard aria-hidden />
            Billing &amp; plan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login">
            <LogIn aria-hidden />
            Log in page
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
