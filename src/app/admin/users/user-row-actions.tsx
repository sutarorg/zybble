"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { setUserRole, setUserStatus } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES = ["learner", "creator", "moderator", "admin"] as const;

export function UserRowActions({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: string;
  status: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    await action().catch(() => ({ ok: false, error: "Something went wrong" }));
    setBusy(false);
    router.refresh();
  }

  if (isSelf) return <span className="text-[12px] text-zinc-400">That&apos;s you</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <ShieldCheck className="size-4" aria-hidden /> Role
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ROLES.map((value) => (
            <DropdownMenuItem
              key={value}
              disabled={busy || value === role}
              onSelect={() => void run(() => setUserRole(userId, value))}
            >
              {value}
              {value === role ? " (current)" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {status === "active" ? (
        <ActionButton
          label="Suspend"
          icon={Ban}
          danger
          confirmTitle={`Suspend ${role}?`}
          confirmBody="Suspension blocks sign-in and ends existing sessions on the Supabase Auth server. Their data is preserved."
          confirmLabel="Suspend account"
          toastText="Account suspended"
          onAction={async () => {
            const result = await setUserStatus(userId, "suspended");
            return result;
          }}
        />
      ) : (
        <ActionButton
          label="Reinstate"
          icon={CheckCircle2}
          confirmTitle="Reinstate this account?"
          confirmBody="The user can sign in again immediately."
          confirmLabel="Reinstate account"
          toastText="Account reinstated"
          onAction={async () => {
            const result = await setUserStatus(userId, "active");
            return result;
          }}
        />
      )}
    </div>
  );
}