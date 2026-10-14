import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

/** Validates the post-auth redirect: same-origin paths only, never `//evil`. */
function safeNext(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up right where you left off."
      footer={
        <>
          New to Zybble?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-primary hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
