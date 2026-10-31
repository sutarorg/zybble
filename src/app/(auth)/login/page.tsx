import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Zybble workspace.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

/**
 * Reasons the proxy sends an unauthenticated visitor back here. They are shown
 * verbatim in the form's alert region, so a misconfigured deployment explains
 * itself instead of bouncing the user onto a blank login page.
 */
const REDIRECT_MESSAGES: Record<string, string> = {
  auth_unavailable:
    "Sign-in is not available right now because the authentication service is not configured. This is a deployment problem, not a problem with your account — please contact support.",
  session_expired: "Your session expired. Sign in again to continue.",
  signed_out: "You have been signed out.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const initialError = error ? (REDIRECT_MESSAGES[error] ?? null) : null;

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Welcome back
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Log in to your Zybble workspace.
        </p>
      </div>
      <AuthForm mode="login" initialError={initialError} />
      <p className="mt-6 text-center text-sm text-slate-600">
        New to Zybble?{" "}
        <Link
          href={siteConfig.links.signup}
          className="font-medium text-brand-700 transition-colors hover:text-brand-800"
        >
          Create a free account
        </Link>
      </p>
    </>
  );
}
