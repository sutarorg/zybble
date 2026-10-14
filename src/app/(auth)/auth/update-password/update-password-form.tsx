"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { updatePasswordAction, type AuthFormState } from "@/app/(auth)/actions";

const INITIAL: AuthFormState = { ok: false };

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePasswordAction, INITIAL);

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you have not used on Zybble before."
      footer={
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Go to dashboard
        </Link>
      }
    >
      <form action={formAction} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>

        {!state.ok && state.error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p role="status" className="text-[12.5px] text-muted-foreground">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
