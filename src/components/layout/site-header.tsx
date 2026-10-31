"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Product", href: siteConfig.links.product },
  { label: "Features", href: siteConfig.links.analytics },
  { label: "Pricing", href: siteConfig.links.pricing },
  { label: "Blog", href: siteConfig.links.blog },
] as const;

function subscribeToScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function SiteHeader() {
  const pathname = usePathname();
  // Scroll state via external store: SSR-safe, no effect-driven setState.
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 8,
    () => false,
  );
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        scrolled
          ? "border-slate-200 bg-white/85 backdrop-blur-lg"
          : "border-transparent bg-white",
      )}
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 lg:px-8"
      >
        <Logo />

        {/* Desktop navigation */}
        <ul className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href={siteConfig.links.login}>Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={siteConfig.links.signup}>Get Started</Link>
          </Button>
        </div>

        {/* Mobile navigation */}
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm md:hidden" />
            <Dialog.Content
              aria-label="Menu"
              className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white p-6 shadow-panel md:hidden"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="inline-flex size-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </Dialog.Close>
              </div>
              <ul className="mt-6 space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Dialog.Close asChild>
                      <Link
                        href={item.href}
                        className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        {item.label}
                      </Link>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <Dialog.Close asChild>
                  <Button asChild size="lg" className="w-full">
                    <Link href={siteConfig.links.signup}>Get Started</Link>
                  </Button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href={siteConfig.links.login}>Log in</Link>
                  </Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </header>
  );
}
