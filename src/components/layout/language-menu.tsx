"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
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
import { LANGUAGES } from "@/lib/config/catalog";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";

export function LanguageMenu() {
  const translateUi = useTranslate();
  const { language, setLanguage } = useApp();
  const dict = getDictionary(language);
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={translateUi(`Language: ${current.label}`)}
          className="flex size-9.5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Globe className="size-4.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel><LocalizedText text={dict.interfaceLanguage} /></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => {
              setLanguage(lang.code);
              toast.success(getDictionary(lang.code).languageChanged(lang.label));
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
