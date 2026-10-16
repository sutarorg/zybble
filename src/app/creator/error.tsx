"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Safety net for the creator area.
 *
 * The studio layout redirects when a visitor is signed out or has no creator
 * profile, so this boundary only sees genuine server faults. It offers a retry
 * and a way out, instead of the bare framework error page.
 */
export default function CreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[creator] render failed", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-[22px] font-bold tracking-tight">
        The creator studio could not load
      </h1>
      <p className="text-[14px] text-muted-foreground">
        Something went wrong on our side. Trying again usually clears it; if it does not, the
        Help Center is the fastest way to reach us.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/creator/signup">Creator onboarding</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Back to Explore</Link>
        </Button>
      </div>
    </div>
  );
}
