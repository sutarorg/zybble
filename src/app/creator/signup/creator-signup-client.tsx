"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCheck, GraduationCap, Layers3, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/providers/app-providers";
import { becomeCreator, saveCreatorProfile } from "@/app/creator/actions";
import { CATEGORIES } from "@/lib/config/catalog";
import { categoryIcon } from "@/lib/icons";
import { Logo } from "@/components/layout/logo";
import { LanguageMenu } from "@/components/layout/language-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Creator onboarding.
 *
 * A single account becomes a creator: the server creates a `creator_profiles`
 * row for the same user id, leaving the learner profile, entitlements, orders
 * and progress untouched. The marketplace commission is a server-side setting
 * and is shown here as a planned default, never as a browser-supplied number.
 */
export function CreatorSignupClient({
  displayName,
  email,
  commissionPercentLabel,
}: {
  displayName: string;
  email: string;
  /** Read from `marketplace_settings` on the server. */
  commissionPercentLabel: string;
}) {
  const router = useRouter();
  const { user, hydrated } = useApp();
  const [step, setStep] = React.useState(0);
  const [username, setUsername] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [topics, setTopics] = React.useState<string[]>([]);
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (step === 1) heading.current?.focus();
  }, [step]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || loading) return;

    if (step === 0) {
      if (username.trim().length < 3) {
        setError("Pick a public username with at least 3 characters.");
        return;
      }
      if (headline.trim().length < 3 || topics.length === 0) {
        setError("Add a headline and choose at least one teaching topic.");
        return;
      }
      setError("");
      setStep(1);
      return;
    }

    if (!terms) {
      setError("Please accept the terms to continue.");
      return;
    }

    setLoading(true);
    setError("");

    const started = await becomeCreator();
    if (!started.ok) {
      setError(started.error ?? "Could not start creator onboarding");
      setLoading(false);
      return;
    }

    const saved = await saveCreatorProfile({
      username: username.trim(),
      displayName: displayName.trim(),
      headline: headline.trim(),
      bio: bio.trim(),
      languages: ["English"],
      topics,
    });

    if (!saved.ok) {
      setError(saved.error ?? "Could not save your creator profile");
      setLoading(false);
      return;
    }

    toast.success("Creator profile created. Next: connect your Razorpay payout account.");
    router.push("/creator/route");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.08fr_1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageMenu />
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium text-muted-foreground hover:bg-muted">
              <ArrowLeft className="size-3.5" /> Explore
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mb-5 flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-primary">
            <Sparkles className="size-3.5" /> Teach on Zybble
          </div>
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Your next chapter.
            <br />
            <span className="text-primary">Someone else&apos;s breakthrough.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Share the skills you have built. Create practical courses, reach learners across India, and get paid through
            Razorpay Route.
          </p>

          {!hydrated ? (
            <div className="mt-8 h-40 animate-pulse rounded-xl bg-muted" />
          ) : !user ? (
            <section className="mt-8 rounded-2xl border border-violet-200 bg-violet-50/50 p-6">
              <h2 className="font-display text-lg font-semibold">Start with your Zybble account</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Sign in first. Your learner account, courses and progress stay exactly as they are when you become a
                creator.
              </p>
              <Button asChild className="mt-5 w-full" size="lg">
                <Link href="/login?next=/creator/signup">
                  Sign in <ArrowRight />
                </Link>
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                New to Zybble?{" "}
                <Link className="font-semibold text-primary hover:underline" href="/signup?next=/creator/signup">
                  Create a free account
                </Link>
              </p>
            </section>
          ) : (
            <>
              <ol aria-label="Setup progress" className="my-7 flex items-center gap-3 text-xs">
                {["Profile", "Confirm"].map((label, index) => (
                  <li
                    key={index}
                    className="flex flex-1 items-center gap-2"
                    aria-current={step === index ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold",
                        step >= index ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step > index ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className={step === index ? "font-semibold" : "text-muted-foreground"}>{label}</span>
                    {index === 0 ? <span className="ml-1 h-px flex-1 bg-border" /> : null}
                  </li>
                ))}
              </ol>

              <form onSubmit={submit} className="space-y-5">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-primary">
                    {user.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
                </div>

                <div>
                  <h2 ref={heading} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
                    {step === 0 ? "Your creator profile" : "Confirm and continue"}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step === 0
                      ? "This is what learners see on your public instructor page."
                      : `Signed in as ${displayName}.`}
                  </p>
                </div>

                {step === 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="username">Public username</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="your-name"
                        maxLength={30}
                        required
                        minLength={3}
                      />
                      <p className="text-[11.5px] text-muted-foreground">
                        Your profile will live at /instructors/{username || "your-name"}.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="headline">Headline</Label>
                      <Input
                        id="headline"
                        value={headline}
                        onChange={(event) => setHeadline(event.target.value)}
                        placeholder="Ship production AI agents"
                        maxLength={100}
                        required
                        minLength={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">
                        Bio <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="What do you teach, and what have you shipped?"
                        maxLength={1000}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                      />
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">Teaching topics</legend>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((category) => {
                          const Icon = categoryIcon(category.icon);
                          const active = topics.includes(category.slug);
                          return (
                            <button
                              key={category.slug}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setTopics((previous) =>
                                  active ? previous.filter((topic) => topic !== category.slug) : [...previous, category.slug]
                                )
                              }
                              className={cn(
                                "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                                active
                                  ? "border-primary bg-accent font-medium text-primary"
                                  : "border-border text-muted-foreground hover:border-violet-300"
                              )}
                            >
                              <Icon className="size-3.5" aria-hidden />
                              {category.name}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-muted/60 p-4">
                      <p className="text-sm font-semibold">
                        {displayName} · /instructors/{username}
                      </p>
                      {headline ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{headline}</p> : null}
                      {bio ? (
                        <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{bio}</p>
                      ) : null}
                      <p className="mt-3 text-xs font-medium text-primary">
                        {topics.map((topic) => CATEGORIES.find((category) => category.slug === topic)?.name ?? topic).join(" · ")}
                      </p>
                      <button
                        type="button"
                        className="mt-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
                        onClick={() => setStep(0)}
                      >
                        Edit
                      </button>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="creator-terms"
                        checked={terms}
                        onCheckedChange={(value) => setTerms(value === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="creator-terms" className="text-xs leading-relaxed font-normal text-muted-foreground">
                        I agree to the{" "}
                        <Link href="/terms" className="font-medium text-primary hover:underline">
                          terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="font-medium text-primary hover:underline">
                          privacy policy
                        </Link>
                        . The planned marketplace commission is {commissionPercentLabel}%, applied per order and shown in
                        every payout statement. Zybble publishes no refund policy.
                      </Label>
                    </div>
                  </>
                )}

                {error ? (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  {step === 0 ? "Continue" : "Create my creator profile"}
                  {step === 0 ? <ArrowRight /> : <Rocket />}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCheck className="size-3.5 text-emerald-600" />
                  Your learning history, courses and progress are untouched.
                </p>
              </form>
            </>
          )}
        </main>
        <p className="text-center text-[11px] text-zinc-400">Teach what you know. Build at your own pace.</p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-violet-200/70 bg-accent p-12 lg:flex lg:flex-col lg:justify-center xl:p-16">
        <div aria-hidden className="absolute -top-20 -right-20 size-96 rounded-full bg-violet-300/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-20 size-80 rounded-full bg-fuchsia-200/50 blur-3xl" />
        <div className="relative mx-auto w-full max-w-md">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-white bg-white/80 text-primary shadow-card">
            <GraduationCap className="size-7" />
          </span>
          <h2 className="font-display mt-6 text-4xl leading-tight font-bold tracking-tight text-violet-950">
            Great knowledge
            <br />
            deserves an audience.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-violet-950/60">
            Build the outline, upload your video, submit for review and publish. Razorpay Route pays you your share
            directly into your Indian bank account.
          </p>
          <div className="mt-8 space-y-3">
            {[
              {
                icon: Layers3,
                title: "Your expertise. Your course.",
                text: "Build a curriculum that feels like you, one lesson at a time.",
              },
              {
                icon: Rocket,
                title: "Start small. Make an impact.",
                text: "Draft privately and submit for review when you are proud of what you have made.",
              },
              {
                icon: GraduationCap,
                title: "Teach and keep learning.",
                text: "One account for everything. Your learning journey carries on.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-3 rounded-xl border border-violet-200/70 bg-white/80 p-4 shadow-card backdrop-blur"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-violet-200 pt-5 text-xs text-violet-950/60">
            <ShieldCheck className="size-4 text-primary" />
            No upfront fee. Paid courses stay disabled until Razorpay confirms your payout account.
          </div>
        </div>
      </aside>
    </div>
  );
}