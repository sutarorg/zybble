"use client";

import { Menu, PenSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getTopbarConfig } from "@/components/app/nav-config";
import { NotificationsMenu } from "@/components/app/notifications-menu";
import { SidebarContent } from "@/components/app/sidebar-content";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

export function AppTopbar() {
  const pathname = usePathname();
  const config = getTopbarConfig(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-lg">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu */}
        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent
              showClose
              className="fixed inset-y-0 left-0 top-0 h-full w-[280px] translate-x-0 translate-y-0 rounded-none border-r border-slate-200 p-0"
            >
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </DialogContent>
          </DialogPortal>
        </Dialog>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-950">
            {config.title}
          </h1>
          {config.subtitle && (
            <p className="hidden truncate text-[13px] text-slate-500 sm:block">
              {config.subtitle}
            </p>
          )}
        </div>

        {config.action === "new-post" && (
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/posts/new">
              <PenSquare aria-hidden />
              New post
            </Link>
          </Button>
        )}

        <NotificationsMenu />
        <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
        <UserMenu compact />
      </div>
    </header>
  );
}
