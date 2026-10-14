"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteOrigin } from "@/lib/env";

export interface AuthFormState {
  ok: boolean;
  error?: string;
  message?: string;
  /** Set when Supabase requires the user to confirm their email address. */
  needsEmailConfirmation?: boolean;
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address");

function safeNext(value: unknown): string {
  // Only same-origin relative paths, so `?next=` cannot become an open redirect.
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function authUnavailable(): AuthFormState {
  return {
    ok: false,
    error: "Accounts are temporarily unavailable. Please try again shortly.",
  };
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return authUnavailable();

  const parsed = z
    .object({
      email: emailSchema,
      password: z.string().min(8, "Enter your password").max(200),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // would let an attacker enumerate registered email addresses.
    return { ok: false, error: "Email or password is incorrect." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return authUnavailable();

  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your full name").max(120),
      email: emailSchema,
      password: z
        .string()
        .min(8, "Use at least 8 characters")
        .max(200)
        .regex(/[a-zA-Z]/, "Include at least one letter")
        .regex(/[0-9]/, "Include at least one number"),
      terms: z.literal("on", { error: "Please accept the Terms and Privacy Policy" }),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const origin = siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { full_name: parsed.data.name },
    },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: false, error: "We could not create your account. Please try again." };
  }

  revalidatePath("/", "layout");

  // When email confirmation is enabled, Supabase returns a user with no session.
  if (!data.session) {
    return {
      ok: true,
      needsEmailConfirmation: true,
      message: "Check your inbox to confirm your email address, then sign in.",
    };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return authUnavailable();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteOrigin()}/auth/update-password`,
  });
  if (error) return { ok: false, error: "We could not send the reset email. Please try again." };

  // Always report success: revealing which addresses are registered would leak
  // account existence to anyone with a browser.
  return {
    ok: true,
    message: "If an account exists for that address, a password reset link is on its way.",
  };
}

export async function updatePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return authUnavailable();
  const parsed = z
    .object({
      password: z
        .string()
        .min(8, "Use at least 8 characters")
        .max(200)
        .regex(/[a-zA-Z]/, "Include at least one letter")
        .regex(/[0-9]/, "Include at least one number"),
      confirm: z.string(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your password" };
  if (parsed.data.password !== parsed.data.confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "We could not update your password. Request a fresh reset link." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Your password has been updated. You can continue to your dashboard." };
}
