import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create your free account",
  description:
    "Start with Zybble Free: one LinkedIn account, 10 scheduled posts a month, unlimited drafts and the content calendar. No credit card required.",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: false },
};

interface SignupPageProps {
  searchParams: Promise<{ plan?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { plan } = await searchParams;
  const isPro = plan === "pro";

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {isPro ? "Get started with Pro" : "Create your free account"}
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          {isPro
            ? "$15 per seat / month once billing opens — nothing charged today."
            : "Free forever. No credit card required."}
        </p>
      </div>
      <AuthForm mode="signup" plan={plan} />
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={siteConfig.links.login}
          className="font-medium text-brand-700 transition-colors hover:text-brand-800"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
