"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { signInAction, signUpAction, type AuthFormState } from "@/app/(auth)/actions";

const INITIAL: AuthFormState = { ok: false };

export function AuthForm({ mode, next = "/dashboard" }: { mode: "login" | "signup"; next?: string }) {
  const isSignup = mode === "signup";
  const action = isSignup ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, INITIAL);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  if (state.ok && state.needsEmailConfirmation) {
    return (
      <div className="space-y-4 text-center" role="status">
        <p className="text-[14px] text-muted-foreground">{state.message}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {isSignup && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {!isSignup && (
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-primary hover:text-primary-hover"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            required
            minLength={8}
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
      </div>

      {isSignup && (
        <div>
          <div className="flex items-start gap-2.5">
            <Checkbox id="terms" name="terms" required className="mt-0.5" />
            <Label htmlFor="terms" className="cursor-pointer text-[13px] leading-snug font-normal text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" className="font-medium text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
        </div>
      )}

      {!state.ok && state.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {isSignup ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
