"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bookmark,
  ChevronDown,
  GraduationCap,
  HelpCircle,
  LogOut,
  Presentation,
  ShieldCheck,
  Compass,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";

export function UserMenu() {
  const router = useRouter();
  const { user, signOut, language } = useApp();
  const dict = getDictionary(language);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">{dict.signIn}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/signup">{dict.getStarted}</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex cursor-pointer items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Avatar className="size-8.5 ring-1 ring-border">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="bg-primary text-[11px] text-white">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="hidden size-3.5 text-zinc-400 sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar className="size-10">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="bg-primary text-xs text-white">{user.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">{user.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <Compass /> Explore
          </Link>
        </DropdownMenuItem>
        {user.role !== "creator" && (
          <DropdownMenuItem asChild>
            <Link href="/creator">
              <Presentation /> Creator studio
              <span className="ml-auto rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                Demo
              </span>
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === "creator" && (
          <DropdownMenuItem asChild>
            <Link href="/creator">
              <Presentation /> Go to Studio
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <ShieldCheck /> Admin portal
            <span className="ml-auto rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
              Demo
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my-learning">
            <GraduationCap /> {dict.myLearning}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wishlist">
            <Bookmark /> {dict.wishlist}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/help">
            <HelpCircle /> {dict.footerHelp}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:bg-red-50 focus:text-destructive [&_svg]:text-destructive"
          onSelect={() => {
            signOut();
            toast.success("Signed out. See you soon!");
            router.push("/");
          }}
        >
          <LogOut /> {dict.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
