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

export default function LoginPage() {
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
      <AuthForm mode="login" />
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
