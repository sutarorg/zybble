import { z } from "zod";
import { timezoneSchema, uuidSchema } from "@/lib/validation/posts";

/**
 * Auth payload validation.
 *
 * Passwords are validated here but never logged: the logger redactor also drops
 * any `password`-shaped key that reaches the structured log pipeline.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, "Enter a valid email address.");

/**
 * Supabase's default minimum is 6; 12 is enforced here because these are
 * long-lived publishing credentials, not a forum account.
 */
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200, "Passwords are limited to 200 characters.");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(80).optional(),
  timezone: timezoneSchema.default("UTC"),
  workspaceName: z.string().trim().min(1).max(80).optional(),
  /** Where the emailed confirmation link should return the user. */
  redirectTo: z.string().trim().max(300).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().trim().max(300).optional(),
});

export const passwordUpdateSchema = z.object({
  password: passwordSchema,
});

export const verifyResendSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().trim().max(300).optional(),
});

export const onboardingSchema = z.object({
  workspaceName: z.string().trim().min(1).max(80),
  timezone: timezoneSchema.default("UTC"),
  fullName: z.string().trim().min(1).max(80).optional(),
});

export const switchWorkspaceSchema = z.object({
  workspaceId: uuidSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
