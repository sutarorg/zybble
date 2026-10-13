"use client";

import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar";
import { SearchBox } from "@/components/layout/search-box";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { LanguageMenu } from "@/components/layout/language-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/layout/logo";
import { IconButton } from "@/components/ui/icon-button";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export function Header() {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-10">
        {/* Mobile nav trigger */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <IconButton
            label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </IconButton>
          <SheetContent side="left" className="w-72 p-0">
            <VisuallyHidden.Root>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden.Root>
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Logo className="lg:hidden" showWordmark={false} />

        {/* Desktop / tablet search */}
        <SearchBox className="mx-auto hidden w-full max-w-xl flex-1 sm:block" />

        {/* Mobile: search collapses to an icon that opens a full-height sheet */}
        <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
          <IconButton
            label="Search courses"
            onClick={() => setSearchOpen(true)}
            className="ml-auto sm:hidden"
          >
            <Search className="size-5" aria-hidden />
          </IconButton>
          <SheetContent side="top" className="p-0">
            <SheetTitle className="sr-only">Search courses</SheetTitle>
            <div className="px-4 py-4 pt-5">
              <SearchBox
                mode="panel"
                autoFocus
                onSubmit={() => setSearchOpen(false)}
                className="w-full"
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="ml-auto flex items-center gap-0.5 sm:ml-0 sm:gap-1">
          <LanguageMenu />
          <NotificationsMenu />
          <div className="mx-1.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
