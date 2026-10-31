"use client";

import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, errorMessage } from "@/lib/api/client";
import { useLocalTimezone } from "@/lib/app/hooks";
import { cn } from "@/lib/utils";

/**
 * Sign-up / sign-in form.
 *
 * Calls `/api/auth/signup` and `/api/auth/login` for real. Two outcomes are
 * reported honestly: Supabase may require an email confirmation before a session
 * exists (nothing is faked into the UI), and a signed-in user without a
 * workspace is sent to onboarding rather than dropped into an empty dashboard.
 */

interface AuthFormProps {
  mode: "login" | "signup";
  /** Set when arriving from a Pro CTA — shown as context, never charged. */
  plan?: string;
}

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

type SignupResponse = {
  requiresEmailConfirmation: boolean;
  userId: string | null;
  sessionState: { requiresOnboarding: boolean } | null;
};

type LoginResponse = { requiresOnboarding: boolean };

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 12;

export function AuthForm({ mode, plan }: AuthFormProps) {
  const router = useRouter();
  const timezone = useLocalTimezone();

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const isSignup = mode === "signup";

  function validate(form: HTMLFormElement) {
    const data = new FormData(form);
    const next: Errors = {};

    if (isSignup && !String(data.get("name") ?? "").trim()) {
      next.name = "Please tell us your name.";
    }

    const email = String(data.get("email") ?? "").trim();
    if (!emailRe.test(email)) next.email = "Enter a valid email address.";

    const password = String(data.get("password") ?? "");
    if (isSignup && password.length < PASSWORD_MIN) {
      next.password = `Use at least ${PASSWORD_MIN} characters — this protects a LinkedIn account.`;
    }
    if (!isSignup && password.length === 0) {
      next.password = "Enter your password.";
    }

    return next;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = validate(form);
    setErrors(next);
    setFormError(null);

    if (Object.keys(next).length > 0) return;

    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    setBusy(true);

    try {
      if (isSignup) {
        const result = await apiPost<SignupResponse>("/api/auth/signup", {
          email,
          password,
          fullName: name || undefined,
          timezone,
        });

        if (result.requiresEmailConfirmation || result.sessionState === null) {
          setConfirmEmail(email);
          return;
        }

        router.replace(result.sessionState.requiresOnboarding ? "/onboarding" : "/dashboard");
      } else {
        const result = await apiPost<LoginResponse>("/api/auth/login", { email, password });
        router.replace(result.requiresOnboarding ? "/onboarding" : "/dashboard");
      }

      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error, "That did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmEmail) return;
    setBusy(true);
    setFormError(null);
    try {
      await apiPost("/api/auth/verify", { email: confirmEmail });
    } catch (error) {
      setFormError(errorMessage(error, "Could not resend the confirmation email."));
    } finally {
      setBusy(false);
    }
  }

  if (confirmEmail) {
    return (
      <div className="w-full rounded-2xl bg-white p-8 shadow-soft ring-1 ring-slate-200">
        <div role="status" className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Confirm your email</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We sent a confirmation link to{" "}
                <span className="font-medium text-slate-800">{confirmEmail}</span>. Open it and
                you land straight in your workspace. No workspace is created until the address is
                confirmed.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void resendConfirmation()}
                >
                  {busy && <Loader2 className="animate-spin" aria-hidden />}
                  Resend link
                </Button>
                <a
                  href="/login"
                  className="text-[13px] font-medium text-brand-700 hover:text-brand-800"
                >
                  Back to log in
                </a>
              </div>
              {formError && (
                <p role="alert" className="mt-3 text-[13px] text-red-600">
                  {formError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-soft ring-1 ring-slate-200">
      {isSignup && plan === "pro" && (
        <p className="mb-5 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[13px] font-medium text-brand-800 ring-1 ring-brand-100">
          Pro selected — you start on Free and can upgrade inside the workspace. Nothing is charged
          at sign-up.
        </p>
      )}

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}

        {isSignup && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Full name
            </label>
            <Input id="name" name="name" autoComplete="name" placeholder="Ada Okafor" />
            {errors.name && (
              <p role="alert" className="mt-1.5 text-[13px] text-red-600">
                {errors.name}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Work email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
          {errors.email && (
            <p role="alert" className="mt-1.5 text-[13px] text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            {!isSignup && (
              <a
                href="/forgot-password"
                className="text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
              >
                Forgot password?
              </a>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? `At least ${PASSWORD_MIN} characters` : "Your password"}
          />
          {errors.password && (
            <p role="alert" className="mt-1.5 text-[13px] text-red-600">
              {errors.password}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className={cn("w-full")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
          {isSignup ? "Create free account" : "Log in"}
        </Button>

        <p className="text-center text-[13px] leading-5 text-slate-500">
          {isSignup
            ? "Free forever for one LinkedIn account and 10 scheduled posts a month. No card required."
            : "Sessions are httpOnly cookies refreshed on every request — nothing is stored in your browser."}
        </p>
      </form>
    </div>
  );
}
