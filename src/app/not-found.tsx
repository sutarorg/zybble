import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-24 text-center">
      <Logo />
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-brand-600">
        404
      </p>
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        This page isn&rsquo;t on the schedule
      </h1>
      <p className="mt-4 max-w-md text-pretty text-lg leading-8 text-slate-600">
        The link may have moved or never existed. Head back home and pick up
        where you left off.
      </p>
      <div className="mt-8">
        <Button asChild size="lg">
          <Link href="/">Back to homepage</Link>
        </Button>
      </div>
    </main>
  );
}
