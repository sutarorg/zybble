import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div
        aria-hidden
        className="bg-grid-blue absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]"
      />
      <div className="relative flex w-full max-w-md flex-col items-center">
        <Logo />
        <div className="mt-8 w-full">{children}</div>
        <Link
          href="/"
          className="mt-8 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700"
        >
          ← Back to zybble.app
        </Link>
      </div>
    </main>
  );
}
