import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Admin topbar.
 *
 * Same chrome as the workspace topbar — sticky, `h-16`, translucent white over
 * a `slate-200` rule — so the two shells look related.
 *
 * It carries only what the sidebar cannot: a wordmark on the widths where the
 * sidebar is hidden, a standing reminder that the console cannot write, and a
 * way back to the product that does not require scrolling to the bottom of the
 * rail.
 */
export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex items-center gap-2.5 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" width={28} height={28} className="size-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Admin</span>
        </Link>

        <div className="flex-1" />

        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:inline-flex">
          <ShieldCheck className="size-3.5 text-brand-600" aria-hidden />
          Read-only
        </span>

        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard">
            <ArrowLeft aria-hidden />
            Back to app
          </Link>
        </Button>
      </div>
    </header>
  );
}
