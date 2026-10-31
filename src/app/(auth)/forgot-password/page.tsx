"use client";

import { AlertTriangle, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, errorMessage } from "@/lib/api/client";

/**
 * Password reset request.
 *
 * `POST /api/auth/password` always reports the same result whether or not the
 * address exists — that is deliberate, so this endpoint cannot be used to
 * discover who has an account. Supabase sends the link.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address on your account.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await apiPost("/api/auth/password", {
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught, "Could not send the reset link."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Mail className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">We&rsquo;ll email you a secure reset link.</p>
      </div>

      {done ? (
        <div role="status" className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Check your inbox</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If an account exists for <span className="font-medium">{email.trim()}</span>, a
                time-limited reset link is on its way. The link opens a recovery session in which
                you can set a new password.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Back to log in
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          className="space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200"
        >
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Account email
            </label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Send reset link
          </Button>
          <p className="text-center text-[13px] leading-5 text-slate-500">
            We never reveal whether an address is registered — the response is identical either way.
          </p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Log in
        </Link>
      </p>
    </>
  );
}
