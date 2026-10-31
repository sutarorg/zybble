"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavItems } from "@/components/app/nav-config";
import { UserMenu } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { useUsage } from "@/lib/app/hooks";
import { cn } from "@/lib/utils";

/** Shared sidebar body — used by the desktop rail and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const usage = useUsage();
  // Server-counted usage for the current billing period; null until loaded.
  const usedThisMonth = usage.data?.scheduledThisMonth ?? null;
  const limit = usage.data?.monthlyLimit ?? null;
  const isPro = usage.data?.plan === "pro";

  return (
    <div className="flex h-full flex-col bg-slate-50/60">
      <div className="flex h-16 items-center border-b border-slate-200/70 px-5">
        <Link href="/dashboard" aria-label="Zybble dashboard" onClick={onNavigate}>
          <span className="inline-flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="" className="size-8 rounded-[9px]" />
            <span className="text-[17px] font-semibold tracking-tight text-slate-900">Zybble</span>
          </span>
        </Link>
      </div>

      <div className="px-4 pt-4">
        <WorkspaceSwitcher />
      </div>

      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {appNavItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.match + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white text-brand-700 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 hover:ring-1 hover:ring-slate-200/70",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-[18px] transition-colors",
                      active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-500",
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Plan indicator */}
      <div className="px-4 pb-3">
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900">
              {isPro ? "Pro plan" : "Free plan"}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {isPro ? "$15/seat/mo" : "$0/mo"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {usedThisMonth === null
              ? "Usage: …"
              : limit === null
                ? `${usedThisMonth} scheduled this month · unlimited`
                : `Scheduled this month: ${usedThisMonth} of ${limit}`}
          </p>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit ?? 0}
            aria-valuenow={usedThisMonth ?? 0}
            aria-label="Monthly scheduled post usage"
          >
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
              style={{
                width: `${limit === null ? 100 : Math.min(100, ((usedThisMonth ?? 0) / limit) * 100)}%`,
              }}
            />
          </div>
          {!isPro && (
            <Link
              href="/settings/billing"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              Upgrade to Pro
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <Separator />
      <div className="p-3">
        <UserMenu />
      </div>
    </div>
  );
}
