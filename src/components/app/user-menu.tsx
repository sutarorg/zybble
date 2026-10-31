"use client";

import { CreditCard, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
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

/**
 * Account menu.
 *
 * Reads `/api/auth/session` and signs out through `POST /api/auth/logout`, which
 * revokes the session server-side and clears the auth cookies — there is no
 * client-side token to forget.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = session.data?.profile ?? null;
  const initials = (profile?.name ?? session.data?.user.email ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      await apiPost("/api/auth/logout", {});
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, "Could not sign you out."));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {session.loading ? <UserRound className="size-4.5" aria-hidden /> : initials}
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
              {session.loading ? <UserRound className="size-4" aria-hidden /> : initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {profile?.name ?? (session.loading ? "Loading…" : "Your account")}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {session.data?.user.email ?? "—"}
              </span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          {session.data?.user.emailVerified === false
            ? "Email not verified"
            : "Account"}
        </DropdownMenuLabel>
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
        {error && (
          <p role="alert" className="px-2 pb-1 text-[12px] text-red-600">
            {error}
          </p>
        )}
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
