"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCheck, GraduationCap, Layers3, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/providers/app-providers";
import { useCreator } from "@/components/providers/creator-provider";
import { getDictionary } from "@/lib/i18n";
import { CATEGORIES } from "@/data/mock-data";
import { PLATFORM_COMMISSION } from "@/lib/creator";
import { Logo } from "@/components/layout/logo";
import { LanguageMenu } from "@/components/layout/language-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function CreatorSignupClient() {
  const translateUi = useTranslate();
  const router = useRouter();
  const { user, hydrated, signIn, language } = useApp();
  const { saveProfile, resetCreatorData } = useCreator();
  const d = getDictionary(language);
  const [step, setStep] = useState(0);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (user?.role === "creator") router.replace("/creator");
  }, [user, router]);
  useEffect(() => { if (step === 1) heading.current?.focus(); }, [step]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || loading) return;
    if (step === 0) {
      if (headline.trim().length < 3 || topics.length === 0) {
        setError(translateUi("Add a headline and choose at least one teaching topic.")); return;
      }
      setError(""); setStep(1); return;
    }
    if (!terms) { setError(d.agreeTerms); return; }
    setLoading(true);
    resetCreatorData();
    saveProfile({ instructorId: `ins_${user.id}`, displayName: user.name, initials: user.initials, avatar: user.avatar,
      headline: headline.trim(), bio: bio.trim(), languages: ["English"], topics,
      onboardedAt: new Date().toISOString(), avatarColor: "bg-violet-100 text-violet-700" });
    // Preserve the learner identity, enrollments, orders and wishlist.
    signIn({ ...user, role: "creator" });
    toast.success(d.csSuccessToast);
    router.push("/creator");
  }

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.08fr_1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2"><LanguageMenu /><Link href="/" className="inline-flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium text-muted-foreground hover:bg-muted"><ArrowLeft className="size-3.5" /><LocalizedText text={d.explore} /></Link></div>
        </header>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mb-5 flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-primary"><Sparkles className="size-3.5" /><LocalizedText text={d.csEyebrow} /></div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"><LocalizedText text={"Your next chapter."} /><br /><span className="text-primary"><LocalizedText text={"Someone else’s breakthrough."} /></span></h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground"><LocalizedText text={"Share the skills you’ve built. Create practical courses, inspire learners, and build something that’s yours."} /></p>
          {!hydrated ? <div className="mt-8 h-40 animate-pulse rounded-xl bg-muted" /> : !user ? (
            <section className="mt-8 rounded-2xl border border-violet-200 bg-violet-50/50 p-6">
              <h2 className="font-display text-lg font-semibold"><LocalizedText text={"Start with your Zybble account"} /></h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><LocalizedText text={"Sign in first. Your learner account, courses and progress stay with you when you become a creator."} /></p>
              <Button asChild className="mt-5 w-full" size="lg"><Link href="/login"><LocalizedText text={d.signIn} /><ArrowRight /></Link></Button>
              <p className="mt-4 text-center text-xs text-muted-foreground"><LocalizedText text={d.newToZybble} /> <Link className="font-semibold text-primary hover:underline" href="/signup"><LocalizedText text={d.createFreeAccount} /></Link></p>
            </section>
          ) : (
            <>
              <ol aria-label={translateUi("Setup progress")} className="my-7 flex items-center gap-3 text-xs">
                {[d.csStepProfile, d.csStepLaunch].map((label, index) => <li key={index} className="flex flex-1 items-center gap-2" aria-current={step === index ? "step" : undefined}><span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-semibold", step >= index ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{step > index ? <Check className="size-4" /> : index + 1}</span><span className={step === index ? "font-semibold" : "text-muted-foreground"}><LocalizedText text={label} /></span>{index === 0 && <span className="ml-1 h-px flex-1 bg-border" />}</li>)}
              </ol>
              <form onSubmit={submit} className="space-y-5">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3.5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-primary"><LocalizedText text={user.initials} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold"><LocalizedText text={user.name} /></p><p className="truncate text-xs text-muted-foreground"><LocalizedText text={user.email} /></p></div><ShieldCheck className="size-5 shrink-0 text-emerald-600" /></div>
                <div><h2 ref={heading} tabIndex={-1} className="font-display text-lg font-semibold outline-none"><LocalizedText text={step === 0 ? d.csProfileTitle : d.csLaunchTitle} /></h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><LocalizedText text={step === 0 ? d.csProfileSubtitle : d.csSignedInAs(user.name)} /></p></div>
                {step === 0 ? <>
                  <div className="space-y-2"><Label htmlFor="headline"><LocalizedText text={d.csHeadline} /></Label><Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={translateUi(d.csHeadlinePlaceholder)} maxLength={100} required minLength={3} /></div>
                  <div className="space-y-2"><Label htmlFor="bio"><LocalizedText text={d.csBio} /> <span className="font-normal text-muted-foreground">(<LocalizedText text={d.optional} />)</span></Label><textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={translateUi(d.csBioPlaceholder)} maxLength={1000} rows={3} className="w-full resize-y rounded-lg border border-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/25" /></div>
                  <fieldset><legend className="mb-2 text-sm font-medium"><LocalizedText text={d.csTopics} /></legend><div className="flex flex-wrap gap-2">{CATEGORIES.map((category, i) => <button key={category.slug} type="button" aria-pressed={topics.includes(category.slug)} onClick={() => setTopics((prev) => prev.includes(category.slug) ? prev.filter((t) => t !== category.slug) : [...prev, category.slug])} className={cn("min-h-9 cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary", topics.includes(category.slug) ? "border-primary bg-accent font-medium text-primary" : "border-border text-muted-foreground hover:border-violet-300")}><LocalizedText text={d.csTopicOptions[i]} /></button>)}</div></fieldset>
                </> : <>
                  <div className="rounded-xl bg-muted/60 p-4"><p className="text-sm font-semibold"><LocalizedText text={headline} /></p>{bio && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"><LocalizedText text={bio} /></p>}<p className="mt-3 text-xs font-medium text-primary"><LocalizedText text={topics.map((t) => d.csTopicOptions[CATEGORIES.findIndex((c) => c.slug === t)]).join(" · ")} /></p><button type="button" className="mt-3 text-xs font-semibold text-primary hover:underline" onClick={() => setStep(0)}><LocalizedText text={d.edit} /></button></div>
                  <div className="flex items-start gap-3"><Checkbox id="creator-terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" /><Label htmlFor="creator-terms" className="text-xs font-normal leading-relaxed text-muted-foreground"><LocalizedText text={"I agree to the"} /><Link href="/terms" className="font-medium text-primary hover:underline"><LocalizedText text={d.footerTerms} /></Link><LocalizedText text={"and"} /><Link href="/privacy" className="font-medium text-primary hover:underline"><LocalizedText text={d.footerPrivacy} /></Link><LocalizedText text={". I understand the platform commission is"} />{Math.round(PLATFORM_COMMISSION * 100)}%.</Label></div>
                </>}
                {error && <p role="alert" className="text-xs text-destructive"><LocalizedText text={error} /></p>}
                <Button type="submit" size="lg" className="w-full" loading={loading}><LocalizedText text={step === 0 ? d.continue : d.csSubmit} />{step === 0 ? <ArrowRight /> : <Rocket />}</Button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><CheckCheck className="size-3.5 text-emerald-600" /><LocalizedText text={"Your learning stays. A new possibility begins."} /></p>
              </form>
            </>
          )}
        </main>
        <p className="text-center text-[11px] text-zinc-400"><LocalizedText text={"Teach what you love. Build at your own pace."} /></p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-violet-200/70 bg-accent p-12 lg:flex lg:flex-col lg:justify-center xl:p-16">
        <div aria-hidden className="absolute -right-20 -top-20 size-96 rounded-full bg-violet-300/30 blur-3xl" /><div aria-hidden className="absolute -bottom-20 -left-20 size-80 rounded-full bg-fuchsia-200/50 blur-3xl" />
        <div className="relative mx-auto w-full max-w-md">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-white bg-white/80 text-primary shadow-card"><GraduationCap className="size-7" /></span>
          <h2 className="font-display mt-6 text-4xl font-bold leading-tight tracking-tight text-violet-950"><LocalizedText text={"Great knowledge"} /><br /><LocalizedText text={"deserves an audience."} /></h2>
          <p className="mt-4 text-sm leading-relaxed text-violet-950/60"><LocalizedText text={"From the first outline to your next big idea, your studio gives you the space and tools to make it happen."} /></p>
          <div className="mt-8 space-y-3">{[
            { icon: Layers3, title: "Your expertise. Your course.", text: "Build a curriculum that feels like you, one lesson at a time." },
            { icon: Rocket, title: "Start small. Make an impact.", text: "Draft privately and publish when you’re proud of what you’ve made." },
            { icon: GraduationCap, title: "Teach and keep learning.", text: "One account for everything. Your learning journey carries on." },
          ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-xl border border-violet-200/70 bg-white/80 p-4 shadow-card backdrop-blur"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><h3 className="text-sm font-semibold"><LocalizedText text={title} /></h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><LocalizedText text={text} /></p></div></div>)}</div>
          <div className="mt-8 flex items-center gap-2 border-t border-violet-200 pt-5 text-xs text-violet-950/60"><ShieldCheck className="size-4 text-primary" /><LocalizedText text={"No upfront fee. No pressure to publish."} /></div>
        </div>
      </aside>
    </div>
  );
}
