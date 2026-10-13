import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="font-display text-[13px] font-bold tracking-[0.2em] text-primary">404</p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          This page wandered off the syllabus
        </h1>
        <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
          The page you are looking for doesn&apos;t exist or was moved. Let&apos;s get you back to
          learning.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button asChild size="lg">
            <Link href="/">
              <Compass aria-hidden />
              Back to Explore
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/help">Get help</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
