import { billableSeats } from "@/features/billing/entitlements";
import { ExternalServiceError } from "@/lib/errors";
import { isDodoConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { updateSubscriptionSeats } from "@/lib/dodo/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow, WorkspaceMemberRow } from "@/lib/supabase/database.types";

/**
 * Seat accounting.
 *
 * Definition (shown verbatim on the billing screen): one seat = one active
 * member of the workspace. Pending invitations are not billed, removed members
 * are not billed, and the workspace always bills at least one seat.
 *
 * Every membership change enqueues `billing/seats.sync`. The job is idempotent:
 * it recomputes the count from the members table and only calls Dodo when the
 * number actually differs from what we last pushed, so a duplicate event or a
 * retry cannot double-bill.
 */

export async function countActiveMembers(workspaceId: string): Promise<number> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId);

  if (error) {
    logger.error("seats.count_failed", { workspaceId, error: error.message });
    throw new Error("Could not count workspace members.");
  }

  return billableSeats((data ?? []) as WorkspaceMemberRow[]);
}

export type SeatSyncResult = {
  workspaceId: string;
  seats: number;
  previousSeats: number | null;
  pushedToProvider: boolean;
  reason: "unchanged" | "updated" | "no_subscription" | "provider_unavailable";
};

export async function syncSeats(input: {
  workspaceId: string;
  actorUserId: string | null;
}): Promise<SeatSyncResult> {
  const admin = createSupabaseAdminClient();

  const seats = await countActiveMembers(input.workspaceId);

  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) {
    logger.error("seats.subscription_load_failed", { error: error.message });
    throw new Error("Could not load the subscription.");
  }

  const row = subscription as SubscriptionRow | null;
  const previousSeats = row?.seats ?? null;

  const { error: updateError } = await admin
    .from("subscriptions")
    .upsert(
      {
        workspace_id: input.workspaceId,
        plan: row?.plan ?? "free",
        status: row?.status ?? "free",
        seats,
        dodo_subscription_id: row?.dodo_subscription_id ?? null,
        dodo_customer_id: row?.dodo_customer_id ?? null,
      } satisfies Partial<SubscriptionRow>,
      { onConflict: "workspace_id" },
    );

  if (updateError) {
    logger.error("seats.update_failed", { error: updateError.message });
    throw new Error("Could not update the seat count.");
  }

  await admin
    .from("workspaces")
    .update({ seats })
    .eq("id", input.workspaceId);

  if (!row?.dodo_subscription_id) {
    return {
      workspaceId: input.workspaceId,
      seats,
      previousSeats,
      pushedToProvider: false,
      reason: "no_subscription",
    };
  }

  if (previousSeats === seats) {
    return {
      workspaceId: input.workspaceId,
      seats,
      previousSeats,
      pushedToProvider: false,
      reason: "unchanged",
    };
  }

  if (!isDodoConfigured()) {
    logger.warn("seats.provider_unavailable", { workspaceId: input.workspaceId, seats });
    return {
      workspaceId: input.workspaceId,
      seats,
      previousSeats,
      pushedToProvider: false,
      reason: "provider_unavailable",
    };
  }

  try {
    await updateSubscriptionSeats({ dodoSubscriptionId: row.dodo_subscription_id, seats });

    await admin.from("audit_logs").insert({
      workspace_id: input.workspaceId,
      actor_type: input.actorUserId ? "user" : "system",
      actor_user_id: input.actorUserId,
      action: "billing.seats_synced",
      entity_type: "subscription",
      entity_id: row.dodo_subscription_id,
      metadata: { seats, previousSeats } as never,
    });

    return {
      workspaceId: input.workspaceId,
      seats,
      previousSeats,
      pushedToProvider: true,
      reason: "updated",
    };
  } catch (error) {
    // A provider failure must not lose the local seat count — the nightly
    // reconciler retries until the numbers agree.
    logger.error("seats.push_failed", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });

    throw new ExternalServiceError(
      "dodo",
      "Seat count updated locally but could not be sent to Dodo Payments. It will retry automatically.",
      { retryable: true, cause: error },
    );
  }
}
