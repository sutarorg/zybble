import Link from "next/link";

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
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">
          Z
        </div>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-widest text-brand-600">
          403
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Access denied
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This area is restricted to platform administrators. If you believe this is a
          mistake, contact the site owner.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to your workspace
        </Link>
      </div>
    </main>
  );
}
