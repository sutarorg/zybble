"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  Check,
  GraduationCap,
  Landmark,
  Rocket,
  Sparkles,
} from "lucide-react";
import { CATEGORIES } from "@/data/mock-data";
import { useCreator } from "@/components/providers/creator-provider";
import { categoryIcon } from "@/lib/icons";
import { initialsOf } from "@/lib/format";
import { PAYOUT_THRESHOLD_USD } from "@/lib/creator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TOPIC_SUGGESTIONS = [
  "chatgpt", "prompting", "n8n", "agents", "marketing", "video", "python", "productivity", "saas", "audio",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { hydrated, profile, saveProfile, payoutSettings, savePayoutSettings } = useCreator();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [headline, setHeadline] = useState(profile.headline);
  const [country, setCountry] = useState(profile.country);
  const [topics, setTopics] = useState<string[]>(profile.topics.slice(0, 3));
  const [firstCategory, setFirstCategory] = useState(profile.topics[0] ? "generative-ai" : "");
  const [method, setMethod] = useState<"bank" | "paypal">("bank");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* once hydrated, refresh defaults if user visits with a fresh profile */
  React.useEffect(() => {
    if (hydrated && !displayName) {
      setDisplayName(profile.displayName);
      setHeadline(profile.headline);
      setCountry(profile.country);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-xl" aria-busy>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-80 rounded-xl" />
      </div>
    );
  }

  const steps = [
    { id: "about", title: "About you", icon: GraduationCap },
    { id: "expertise", title: "Your expertise", icon: Sparkles },
    { id: "payout", title: "Getting paid", icon: Rocket },
  ];

  const continueStep = () => {
    if (step === 0) {
      const errs: Record<string, string> = {};
      if (displayName.trim().length < 2) errs.displayName = "Tell learners your name.";
      if (headline.trim().length < 4) errs.headline = "Add a short headline (e.g. role + company).";
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    if (step === 1 && topics.length === 0) {
      setErrors({ topics: "Pick at least one topic." });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const finish = () => {
    saveProfile({
      displayName: displayName.trim(),
      headline: headline.trim(),
      country: country.trim() || profile.country,
      topics,
      initials: initialsOf(displayName.trim()),
      onboardedAt: new Date().toISOString(),
    });
    if (details.trim().length >= 4) {
      savePayoutSettings({
        method,
        accountName: displayName.trim(),
        details: details.trim(),
        threshold: payoutSettings?.threshold ?? PAYOUT_THRESHOLD_USD,
      });
    }
    toast.success("Welcome aboard — your studio is ready.");
    router.push("/creator");
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* Header */}
      <div className="text-center">
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator onboarding</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">
          {step === 0 && "Tell learners who you are"}
          {step === 1 && "What will you teach?"}
          {step === 2 && "One last thing — getting paid"}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Takes about a minute. Everything saves locally in this demo.
        </p>
      </div>

      {/* Progress */}
      <div className="mt-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-medium transition-colors",
                i === step
                  ? "bg-primary text-white shadow-sm"
                  : i < step
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-zinc-400"
              )}
            >
              {i < step ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <s.icon className="size-3.5" aria-hidden />}
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Card */}
      <div className="mt-5 rounded-xl border border-border bg-white p-6 shadow-card sm:p-7">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 ring-1 ring-border">
                <AvatarFallback className={cn("text-base font-bold", profile.avatarColor)}>
                  {initialsOf(displayName || "Z C")}
                </AvatarFallback>
              </Avatar>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                This is your public instructor identity. You can polish everything later in{" "}
                <Link href="/creator/profile" className="font-medium text-primary hover:underline">
                  Profile
                </Link>
                .
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-name">Display name *</Label>
              <Input id="ob-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-invalid={!!errors.displayName} />
              {errors.displayName && <p className="text-[12px] font-medium text-destructive">{errors.displayName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-headline">Headline *</Label>
              <Input id="ob-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Data scientist · ex-Spotify" aria-invalid={!!errors.headline} />
              {errors.headline && <p className="text-[12px] font-medium text-destructive">{errors.headline}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-country">Country</Label>
              <Input id="ob-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Portugal" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Teaching topics *</Label>
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_SUGGESTIONS.map((topic) => {
                  const active = topics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTopics((t) => (active ? t.filter((x) => x !== topic) : [...t, topic]))}
                      className={cn(
                        "h-8 cursor-pointer rounded-full border px-3 text-[12.5px] font-medium capitalize transition-all",
                        active
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
                      )}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
              {errors.topics && <p className="text-[12px] font-medium text-destructive">{errors.topics}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Your first course will likely be in…</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => {
                  const Icon = categoryIcon(c.icon);
                  const active = firstCategory === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFirstCategory(c.slug)}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                        active ? "border-primary bg-accent/60 shadow-xs" : "border-border bg-white hover:border-zinc-300"
                      )}
                    >
                      <Icon className={cn("size-4.5", active ? "text-primary" : "text-zinc-400")} aria-hidden />
                      <span className="text-[11px] leading-tight font-medium">{c.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "bank", label: "Bank transfer", icon: Building },
                { id: "paypal", label: "PayPal", icon: Landmark },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={method === opt.id}
                  onClick={() => setMethod(opt.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 transition-all",
                    method === opt.id ? "border-primary bg-accent/60 shadow-xs" : "border-border bg-white hover:border-zinc-300"
                  )}
                >
                  <opt.icon className={cn("size-4.5", method === opt.id ? "text-primary" : "text-zinc-400")} aria-hidden />
                  <span className="text-[13px] font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-details">
                {method === "bank" ? "IBAN / account (masked display)" : "PayPal email"}{" "}
                <span className="font-normal text-zinc-400">(optional — skip for now)</span>
              </Label>
              <Input
                id="ob-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={method === "bank" ? "SE35 •••• ••48 21" : "you@example.com"}
              />
            </div>

            {/* Review summary */}
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase">Your setup</p>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{displayName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Topics</dt>
                  <dd className="text-right font-medium capitalize">{topics.join(", ") || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">First category</dt>
                  <dd className="font-medium">{CATEGORIES.find((c) => c.slug === firstCategory)?.name ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex items-center justify-between">
          {step === 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                toast("Skipped — using the existing demo profile.");
                router.push("/creator");
              }}
            >
              Skip for now
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={continueStep}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button onClick={finish} size="lg">
              <Rocket aria-hidden />
              Enter the studio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
