"use client";
import { LocalizedText } from "@/components/providers/localized-text";
import Link from "next/link";
import { ArrowUpRight, Presentation, Sparkles } from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";

export function TeachingCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user, language } = useApp();
  const d = getDictionary(language);
  const creator = user?.role === "creator";
  return <Link href={creator ? "/creator" : "/creator/signup"} onClick={onNavigate} className="group relative block overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 transition-all hover:border-violet-300 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-primary">
    <div className="mb-3 flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm">{creator ? <Presentation className="size-4.5" /> : <Sparkles className="size-4.5" />}</span><ArrowUpRight className="size-4 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
    <p className="text-[13px] font-semibold"><LocalizedText text={creator ? d.goToStudio : d.startTeaching} /></p>
    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground"><LocalizedText text={creator ? d.goToStudioDesc : d.startTeachingDesc} /></p>
  </Link>;
}
