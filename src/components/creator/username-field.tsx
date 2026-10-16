"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { checkUsernameAvailability, type UsernameAvailability } from "@/app/creator/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Long enough that typing a name costs two checks, not twelve. */
const CHECK_DELAY_MS = 400;
/** Below the schema's minimum there is nothing to check. */
const MIN_LENGTH = 3;

type Verdict = { kind: "idle" } | { kind: "checked"; result: UsernameAvailability };

/**
 * Public username with a live availability check.
 *
 * The tick is earned, not assumed: it only appears once the server has answered
 * for the exact string in the field. A response that arrives after the creator
 * kept typing is discarded rather than painted over a different value, and a
 * failure to check is reported as "cannot be checked" — never as a green tick,
 * because the save that follows is the only thing that actually claims the name.
 *
 * "Checking" is derived rather than stored: a value long enough to be checkable
 * with no matching verdict is by definition still in flight. That keeps the
 * scheduling effect free of synchronous state updates, so a keystroke cannot
 * cascade two renders.
 */
export function UsernameField({
  id,
  value,
  onChange,
  label = "Username",
  hint,
  className,
  inputClassName,
  required = true,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
}) {
  const [verdict, setVerdict] = React.useState<Verdict>({ kind: "idle" });
  /** Increments per keystroke so a late response cannot win. */
  const request = React.useRef(0);

  React.useEffect(() => {
    const normalized = value.trim().toLowerCase();
    if (normalized.length < MIN_LENGTH) return;

    const id = ++request.current;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(normalized)
        .then((result) => {
          if (cancelled || request.current !== id) return;
          setVerdict({ kind: "checked", result });
        })
        .catch(() => {
          if (cancelled || request.current !== id) return;
          setVerdict({
            kind: "checked",
            result: {
              available: false,
              reason: "unavailable",
              message: "Availability cannot be checked right now",
              checked: normalized,
            },
          });
        });
    }, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  const normalized = value.trim().toLowerCase();
  const current =
    verdict.kind === "checked" && verdict.result.checked === normalized ? verdict.result : null;
  const checking = normalized.length >= MIN_LENGTH && !current;

  const tone = !current
    ? null
    : current.available
      ? current.reason === "own"
        ? "muted"
        : "good"
      : current.reason === "unavailable" || current.reason === "rate_limited"
        ? "warn"
        : "bad";

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="block text-[13px]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          required={required}
          minLength={MIN_LENGTH}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="your-name"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          aria-describedby={`${id}-status`}
          aria-invalid={tone === "bad" ? true : undefined}
          className={cn("pr-9", tone === "bad" && "border-red-300 focus-visible:ring-red-200", inputClassName)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden>
          {checking ? (
            <Loader2 className="size-4 animate-spin text-zinc-400" />
          ) : tone === "good" ? (
            <CheckCircle2 className="size-4.5 text-emerald-600" />
          ) : tone === "muted" ? (
            <CheckCircle2 className="size-4.5 text-zinc-400" />
          ) : tone === "bad" ? (
            <XCircle className="size-4.5 text-red-600" />
          ) : tone === "warn" ? (
            <XCircle className="size-4.5 text-amber-500" />
          ) : null}
        </span>
      </div>

      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className={cn(
          "text-[11.5px] leading-relaxed",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-red-600",
          tone === "warn" && "text-amber-700",
          (!tone || tone === "muted") && "text-zinc-400"
        )}
      >
        {current ? (
          current.available && current.reason !== "own" ? (
            <>
              {current.message} · your page will be /instructors/{normalized}
            </>
          ) : (
            current.message
          )
        ) : checking ? (
          "Checking availability…"
        ) : (
          hint ?? "Lowercase letters, numbers and hyphens. At least 3 characters."
        )}
      </p>
    </div>
  );
}
