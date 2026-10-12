"use client";

import { Check, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";

export function LanguageMenu() {
  const { language, setLanguage } = useApp();
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Language: ${current.label}`}
          className="hidden size-9.5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none md:flex"
        >
          <Globe className="size-4.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Interface language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => {
              setLanguage(lang.code);
              toast.success(`Language preference saved: ${lang.label} (demo)`);
            }}
            className="justify-between"
          >
            <span>
              <span className="block text-[13px]">{lang.native}</span>
              {lang.native !== lang.label && (
                <span className="block text-[11px] text-zinc-400">{lang.label}</span>
              )}
            </span>
            {language === lang.code && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
