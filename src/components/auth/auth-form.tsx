"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Frontend-only auth form. Validation runs locally; submission is honestly
 * disclosed as not yet connected (the backend arrives with the workspace
 * milestone) — no fake success states.
 */
export function AuthForm({ mode, plan }: AuthFormProps) {
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
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
    if (password.length < 8) next.password = "Use at least 8 characters.";
    return next;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate(event.currentTarget);
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  }

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-soft ring-1 ring-slate-200">
      {isSignup && plan === "pro" && (
        <p className="mb-5 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[13px] font-medium text-brand-800 ring-1 ring-brand-100">
          Pro selected — you&rsquo;ll choose billing inside the workspace once
          subscriptions open. Nothing is charged today.
        </p>
      )}

      {submitted ? (
        <div role="status" className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Thanks — you&rsquo;re early, and that&rsquo;s great.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This is Zybble&rsquo;s live interface, but account creation
                isn&rsquo;t wired to a backend yet — no account was created and
                nothing was stored. The workspace (authentication, LinkedIn
                connection and scheduling) ships with the next release.
              </p>
              <Link
                href="/blog"
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Meanwhile: read the LinkedIn playbooks →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
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
                <Link
                  href="/forgot-password"
                  className="text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p role="alert" className="mt-1.5 text-[13px] text-red-600">
                {errors.password}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className={cn("w-full")}>
            {isSignup ? "Create free account" : "Log in"}
          </Button>
          <p className="text-center text-[13px] leading-5 text-slate-500">
            Authentication goes live with the workspace release. Trying the form
            only validates your input — nothing is submitted anywhere.
          </p>
        </form>
      )}
    </div>
  );
}
