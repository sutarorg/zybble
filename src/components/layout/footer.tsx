"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import Link from "next/link";
import { ZybbleMark } from "@/components/layout/logo";
import { CATEGORIES } from "@/lib/config/catalog";
import { getDictionary } from "@/lib/i18n";
import { useApp } from "@/components/providers/app-providers";

export function Footer() {
  const translateUi = useTranslate();
  const { language } = useApp();
  const dict = getDictionary(language);

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: dict.categories,
      links: CATEGORIES.slice(0, 4).map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
    },
    {
      title: dict.footerCompany,
      links: [
        { label: dict.footerAbout, href: "/about" },
        { label: dict.footerHelp, href: "/help" },
        { label: dict.myLearning, href: "/my-learning" },
        { label: dict.wishlist, href: "/wishlist" },
      ],
    },
    {
      title: dict.footerLegal,
      links: [
        { label: dict.footerTerms, href: "/terms" },
        { label: dict.footerPrivacy, href: "/privacy" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="page-container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <ZybbleMark />
              <span className="font-display text-lg font-bold tracking-tight"><LocalizedText text={"Zybble"} /></span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              <LocalizedText text={dict.footerTagline} />
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={translateUi(col.title)}>
              <p className="text-[11.5px] font-semibold tracking-wider text-zinc-400 uppercase">
                <LocalizedText text={col.title} />
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <LocalizedText text={link.label} />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[12.5px] text-zinc-400">
            <LocalizedText text={dict.footerCopyright(new Date().getFullYear())} /></p>

        </div>
      </div>
    </footer>
  );
}
