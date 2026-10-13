import { LocalizedText } from "@/components/providers/localized-text";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Join Zybble and start learning practical AI skills today.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever for free courses. Upgrade any course when you're ready."
      footer={
        <><LocalizedText text={"Already have an account?"} /><LocalizedText text={" "} />
          <Link href="/login" className="font-medium text-primary hover:underline"><LocalizedText text={"Sign in"} /></Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
