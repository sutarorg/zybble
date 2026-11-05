import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Second-line denial, rendered by the `/admin` layout.
 *
 * The proxy normally answers non-admin requests with a real 403 before this
 * page can render. It exists so that the page tree is safe on its own: if the
 * proxy rule were ever removed or misconfigured, an unauthorised visitor still
 * gets no data rather than a working dashboard.
 *
 * It says nothing about *why* beyond "not permitted" — it must not confirm
 * whether an allowlist exists, or how close the visitor is to being on it.
 */
export function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-xs ring-1 ring-slate-200">
          <ShieldOff className="size-5" aria-hidden />
        </span>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-widest text-brand-600">
          403
        </p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-950">
          Access denied
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This area is restricted to platform administrators. If you believe this is a
          mistake, contact the site owner.
        </p>
        <Button asChild variant="secondary" className="mt-7">
          <Link href="/dashboard">Back to your workspace</Link>
        </Button>
      </div>
    </main>
  );
}
