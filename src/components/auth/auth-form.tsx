"use client";

import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";
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

/**
 * Google's mark.
 *
 * Lucide dropped brand glyphs, and this is one place the real logo matters:
 * a generic icon beside the word "Google" reads as a bug, and Google's
 * trademark guidelines ask that the four-colour mark be used unaltered.
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false" className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.55 10.78l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface AuthFormProps {
  mode: "login" | "signup";
  /** Set when arriving from a Pro CTA — shown as context, never charged. */
  plan?: string;
  /**
   * Prefilled email. Arrives from `/login?email=…`, which the sign-up form
   * links to when it discovers the address already has an account.
   */
  initialEmail?: string;
  /**
   * A message the server already knows about, e.g. the proxy bounced the user
   * here because auth is not configured. Shown in the same place as a submit
   * failure so a redirect never lands on a silent form.
   */
  initialError?: string | null;
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
  emailTaken: boolean;
};

type LoginResponse = { requiresOnboarding: boolean };

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 12;

export function AuthForm({ mode, plan, initialEmail = "", initialError = null }: AuthFormProps) {
  const router = useRouter();
  const timezone = useLocalTimezone();

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  /** Set when sign-up found an existing account for this address. */
  const [emailTakenFor, setEmailTakenFor] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
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
    setEmailTakenFor(null);

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

        // Handled before the email-confirmation branch on purpose: without it
        // an existing account is told to confirm an email that will never
        // arrive, because there is nothing left to confirm.
        if (result.emailTaken) {
          setEmailTakenFor(email);
          return;
        }

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

  /**
   * Hand the browser to Google.
   *
   * The whole page navigates, so this never comes back on the success path —
   * `busy` stays set on purpose to stop a second click while the redirect is
   * in flight.
   */
  async function startGoogle() {
    setGoogleBusy(true);
    setFormError(null);

    try {
      const { url } = await apiPost<{ url: string }>("/api/auth/google", {});
      window.location.assign(url);
    } catch (error) {
      setGoogleBusy(false);
      setFormError(errorMessage(error, "Could not start Google sign-in."));
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

        {emailTakenFor && (
          <div
            role="alert"
            className="rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <div className="text-[13px] leading-6 text-amber-900">
                <p>
                  <span className="font-medium">{emailTakenFor}</span> already has a Zybble
                  account.
                </p>
                <a
                  href={`/login?email=${encodeURIComponent(emailTakenFor)}`}
                  className="mt-1 inline-block font-semibold underline underline-offset-2 transition-colors hover:text-amber-950"
                >
                  Log in instead →
                </a>
              </div>
            </div>
          </div>
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
            defaultValue={initialEmail}
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
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? `At least ${PASSWORD_MIN} characters` : "Your password"}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="password"
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" aria-hidden />
              ) : (
                <Eye className="size-[18px]" aria-hidden />
              )}
            </button>
          </div>
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

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            or
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={busy || googleBusy}
          onClick={() => void startGoogle()}
        >
          {googleBusy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <GoogleIcon className="size-[18px]" />
          )}
          Continue with Google
        </Button>

        <p className="text-center text-[13px] leading-5 text-slate-500">
          {isSignup
            ? "Free forever for one LinkedIn account and 10 scheduled posts a month. No card required."
            : "Zybble encrypts your LinkedIn token at rest and publishes only what you schedule — nothing goes out on its own."}
        </p>
      </form>
    </div>
  );
}
