"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import { initialsOf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authenticate, registerAccount } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const translateUi = useTranslate();
  const router = useRouter();
  const { signIn, language } = useApp();
  const dict = getDictionary(language);
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; terms?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (isSignup && name.trim().length < 2) next.name = dict.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = dict.errEmail;
    if (password.length < 8) next.password = dict.errPasswordShort;
    if (isSignup && !terms) next.terms = dict.agreeTerms;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const account = isSignup
      ? { id: crypto.randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), initials: initialsOf(name), role: "learner" as const }
      : authenticate(email, password);
    if (!account) { setErrors({ password: dict.errCredentials }); return; }
    if (isSignup && !registerAccount(account, password)) {
      setErrors({ email: translateUi("An account with this email already exists.") }); return;
    }
    setLoading(true);
    signIn(account);
    toast.success(isSignup ? dict.welcomeToast(account.name.split(" ")[0]) : dict.welcomeBackToast);
    router.push("/");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {isSignup && (
        <div className="space-y-1.5">
          <Label htmlFor="name"><LocalizedText text={"Full name"} /></Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder={translateUi("Ada Lovelace")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-[12px] text-destructive"><LocalizedText text={errors.name} /></p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email"><LocalizedText text={"Email"} /></Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={translateUi("you@example.com")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-[12px] text-destructive"><LocalizedText text={errors.email} /></p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password"><LocalizedText text={"Password"} /></Label>
          {!isSignup && (
            <button
              type="button"
              onClick={() => toast.info("Contact support to reset your password.")}
              className="cursor-pointer text-[12px] font-medium text-primary hover:text-primary-hover"
            ><LocalizedText text={"Forgot password?"} /></button>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "8+ characters" : "Your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-zinc-400 transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p className="text-[12px] text-destructive"><LocalizedText text={errors.password} /></p>}
      </div>

      {isSignup && (
        <div>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="cursor-pointer text-[13px] leading-snug font-normal text-muted-foreground"><LocalizedText text={"I agree to the"} /><LocalizedText text={" "} />
              <Link href="/terms" className="font-medium text-primary hover:underline"><LocalizedText text={"Terms of Service"} /></Link><LocalizedText text={" "} /><LocalizedText text={"and"} /><LocalizedText text={" "} />
              <Link href="/privacy" className="font-medium text-primary hover:underline"><LocalizedText text={"Privacy Policy"} /></Link>
              .
            </Label>
          </div>
          {errors.terms && <p className="mt-1.5 text-[12px] text-destructive"><LocalizedText text={errors.terms} /></p>}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {isSignup ? "Create account" : "Sign in"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border" />
        </div>
        <p className="relative flex justify-center">
          <span className="bg-white px-3 text-[11.5px] text-zinc-400"><LocalizedText text={"or continue with"} /></span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={() => toast.info("Social sign-in is not available yet. Please use email and password.")}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
            />
          </svg><LocalizedText text={"Google"} /></Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => toast.info("Social sign-in is not available yet. Please use email and password.")}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5" />
          </svg><LocalizedText text={"GitHub"} /></Button>
      </div>
    </form>
  );
}
