import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, CircleDashed, Upload } from "lucide-react";
import { getCreatorCourses, getRouteOnboardingState } from "@/lib/server/creator";
import { requireCreator } from "@/lib/server/session";
import { CREATOR_STEPS } from "@/lib/creator";
import { WizardStepper } from "@/components/creator/wizard-stepper";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/creator/status-badge";

export const metadata = { title: "Onboarding" };
export const dynamic = "force-dynamic";

export default async function CreatorOnboardingPage() {
  const session = await requireCreator();
  const [courses, route] = await Promise.all([getCreatorCourses(), getRouteOnboardingState()]);

  const hasUsername = Boolean(session.creator?.username);
  const hasCourse = courses.length > 0;
  const submitted = courses.some((course) => course.status === "pending");
  const published = courses.some((course) => course.status === "published");

  const steps = [
    { id: "profile", done: hasUsername, href: "/creator/profile", cta: "Edit your profile" },
    { id: "route", done: route.settlementVerified, href: "/creator/payouts", cta: "Set up payouts" },
    { id: "course", done: hasCourse, href: "/creator/courses/new", cta: "Create a course" },
    { id: "review", done: published, href: "/creator/courses", cta: "View your courses" },
  ] satisfies Array<{ id: string; done: boolean; href: string; cta: string }>;

  const nextStep = steps.find((step) => !step.done);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Creator onboarding</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Four steps to a live course. Every step reflects real state in the database — nothing here is
          pre-filled or assumed.
        </p>
      </header>

      <WizardStepper steps={steps.map((step, index) => ({ title: CREATOR_STEPS[index].title, done: step.done }))} />

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const meta = CREATOR_STEPS[index];
          return (
            <li key={step.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    step.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                  aria-hidden
                >
                  {step.done ? <Check className="size-4" /> : <CircleDashed className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14.5px] font-semibold tracking-tight">
                    {index + 1}. {meta.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{meta.description}</p>

                  {step.id === "route" && route.blockedReason ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                      {route.blockedReason}
                    </p>
                  ) : null}
                  {step.id === "review" && submitted ? (
                    <p className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      {courses
                        .filter((course) => course.status === "pending")
                        .map((course) => (
                          <span key={course.id} className="inline-flex items-center gap-1.5">
                            {course.title}
                            <StatusBadge status={course.status} />
                          </span>
                        ))}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <Button asChild variant={step.done ? "outline" : "default"} size="sm">
                      <Link href={step.href}>{step.cta}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {nextStep ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5 text-[13px]">
          <Upload className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Next up: <strong>{CREATOR_STEPS[steps.findIndex((step) => step.id === nextStep.id)].title}</strong>.{" "}
            <Link className="font-medium text-primary underline" href={nextStep.href}>
              Continue
            </Link>
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[13px] text-emerald-900">
          Your creator profile is complete. Keep publishing on{" "}
          <Link href="/creator/courses" className="font-medium underline">
            your courses page
          </Link>
          .
        </div>
      )}

      {!published ? (
        <p className="text-[12.5px] text-muted-foreground">
          <strong className="font-medium">Heads up:</strong> Zybble publishes no course until an
          administrator reviews it, and a paid course additionally requires Razorpay to report your Route
          account as active.
        </p>
      ) : null}
    </div>
  );
}