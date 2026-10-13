import { LocalizedText } from "@/components/providers/localized-text";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Zybble account.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up right where you left off."
      footer={
        <><LocalizedText text={"New to Zybble?"} /><LocalizedText text={" "} />
          <Link href="/signup" className="font-medium text-primary hover:underline"><LocalizedText text={"Create a free account"} /></Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
