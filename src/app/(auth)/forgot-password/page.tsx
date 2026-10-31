"use client";

import { Info, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Password reset UI — honest that email delivery ships with the backend. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address on your account.");
      return;
    }
    setError(null);
    setDone(true);
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
        <p className="mt-2 text-[15px] text-slate-600">
          We&rsquo;ll email you a secure reset link.
        </p>
      </div>

      {done ? (
        <div role="status" className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Reset emails go live with the backend
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                You entered a valid address — but no email was sent, because
                authentication and transactional email (Resend) ship with the
                next release. When live, this screen sends a time-limited reset
                link and confirms it the same way.
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
        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200">
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
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
            />
            {error && (
              <p role="alert" className="mt-1.5 text-[13px] text-red-600">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-[13px] leading-5 text-slate-500">
            Email delivery activates with authentication — trying the form only
            validates your input.
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
