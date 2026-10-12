"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar";
import { SearchBox } from "@/components/layout/search-box";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { LanguageMenu } from "@/components/layout/language-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/layout/logo";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export function Header() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile nav trigger */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="flex size-9.5 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <SheetContent side="left" className="w-72 p-0">
            <VisuallyHidden.Root>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden.Root>
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Logo className="lg:hidden" showWordmark={false} />

        <SearchBox className="mx-auto w-full max-w-xl flex-1" />

        <div className="flex items-center gap-0.5 sm:gap-1">
          <LanguageMenu />
          <NotificationsMenu />
          <div className="mx-1.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
