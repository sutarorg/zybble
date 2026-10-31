"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPatch, errorMessage } from "@/lib/api/client";

/**
 * Set a new password.
 *
 * Only reachable inside a recovery session, which `/auth/callback` establishes
 * when Supabase redirects back from the emailed link. `PATCH /api/auth/password`
 * rejects the call otherwise, so a stale bookmark cannot change anything.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiPatch("/api/auth/password", { password });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          "Could not update your password. Reset links expire — request a new one.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Choose a new password</h1>
        <p className="mt-2 text-[15px] text-slate-600">
          This link opened a recovery session for your account.
        </p>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200"
      >
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            New password
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="mt-1.5 text-[13px] text-slate-500">At least 12 characters.</p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Confirm password
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy || password.length === 0}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to log in
        </Link>
      </p>
    </>
  );
}
