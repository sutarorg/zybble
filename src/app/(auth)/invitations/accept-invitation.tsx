"use client";

import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/app/hooks";

/**
 * Accept a workspace invitation.
 *
 * This page is the destination of the link in the team-invitation email. The
 * API it talks to already existed (`/api/invitations`) and the email already
 * pointed here — the route itself was simply never built, so every invitation
 * email linked to a 404.
 *
 * The raw token only ever travels in the URL and in the request body; the
 * server hashes it before it reaches the database, and the preview endpoint
 * never returns it.
 */

type Preview = {
  valid: boolean;
  expired: boolean;
  role: string;
  workspaceName: string;
  invitedAt: string | null;
  emailHint: string;
};

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "expired"; preview: Preview }
  | { kind: "ready"; preview: Preview }
  | { kind: "accepting"; preview: Preview }
  | { kind: "accepted" }
  | { kind: "error"; message: string; preview: Preview | null };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function AcceptInvitation() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();

  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "missing" });
      return;
    }

    let cancelled = false;

    apiGet<Preview>("/api/invitations", { token })
      .then((preview) => {
        if (cancelled) return;
        if (!preview.valid) {
          setState({ kind: "missing" });
        } else if (preview.expired) {
          setState({ kind: "expired", preview });
        } else {
          setState({ kind: "ready", preview });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "missing" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setState((current) =>
      current.kind === "ready" ? { kind: "accepting", preview: current.preview } : current,
    );

    try {
      const { workspaceId } = await apiPost<{ workspaceId: string }>("/api/invitations", {
        token,
      });

      // Join the workspace straight away, otherwise the app keeps reading the
      // cookie for whichever workspace the member was in before (or none).
      await apiPost("/api/workspaces/switch", { workspaceId });

      setState({ kind: "accepted" });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setState((current) => ({
        kind: "error",
        message: errorMessage(
          caught,
          "Could not accept this invitation. Ask the person who invited you to send a new one.",
        ),
        preview: current.kind === "accepting" ? current.preview : null,
      }));
    }
  }, [router, token]);

  const shell = (children: React.ReactNode) => (
    <div className="rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200">{children}</div>
  );

  if (state.kind === "loading") {
    return shell(
      <p className="flex items-center justify-center gap-2 py-4 text-[15px] text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking your invitation…
      </p>,
    );
  }

  if (state.kind === "missing") {
    return (
      <>
        {shell(
          <div className="text-center">
            <AlertTriangle className="mx-auto size-6 text-amber-600" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
              This invitation link is not valid
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">
              It may have already been accepted or revoked. Ask whoever invited you to send a
              fresh invitation.
            </p>
          </div>,
        )}
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Go to log in
          </Link>
        </p>
      </>
    );
  }

  if (state.kind === "expired") {
    return shell(
      <div className="text-center">
        <AlertTriangle className="mx-auto size-6 text-amber-600" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
          This invitation has expired
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">
          The invitation to <strong className="font-medium">{state.preview.workspaceName}</strong> is
          no longer open. Invitations are time-limited, so ask for a new one.
        </p>
      </div>,
    );
  }

  if (state.kind === "accepted") {
    return shell(
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-6 text-brand-600" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">You are in</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">Taking you to the workspace…</p>
      </div>,
    );
  }

  const preview = state.kind === "ready" || state.kind === "accepting" ? state.preview : state.preview;
  const busy = state.kind === "accepting";
  const signedIn = session.data !== null && session.data !== undefined;

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Join {preview?.workspaceName ?? "a workspace"}
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          You have been invited to collaborate on scheduled LinkedIn posts.
        </p>
      </div>

      {shell(
        <>
          {state.kind === "error" && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.message}
            </p>
          )}

          <dl className="space-y-3 text-[15px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Workspace</dt>
              <dd className="font-medium text-slate-900">{preview?.workspaceName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Your role</dt>
              <dd className="font-medium text-slate-900">
                {ROLE_LABEL[preview?.role ?? ""] ?? preview?.role ?? "Member"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Sent to</dt>
              <dd className="flex items-center gap-1.5 font-medium text-slate-900">
                <Mail className="size-3.5 text-slate-400" aria-hidden />
                {preview?.emailHint}
              </dd>
            </div>
          </dl>

          {signedIn ? (
            <Button
              type="button"
              size="lg"
              className="mt-6 w-full"
              disabled={busy}
              onClick={() => void accept()}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Accept invitation
            </Button>
          ) : (
            <div className="mt-6 space-y-2.5">
              <p className="text-[13px] leading-6 text-slate-600">
                You need a Zybble account on this email address before you can accept. Create one
                (or log in), then open this link again.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/signup">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          )}
        </>,
      )}
    </>
  );
}
