import type { Metadata } from "next";
import { getSession } from "@/lib/server/session";
import { getMarketplaceCommissionBps } from "@/lib/server/creator";
import { CreatorSignupClient } from "./creator-signup-client";

export const metadata: Metadata = {
  title: "Become a Creator - Zybble",
  description:
    "Teach practical AI skills on Zybble. Same account, creator studio, Razorpay Route payouts in INR.",
};

export const dynamic = "force-dynamic";

export default async function CreatorSignupPage() {
  const session = await getSession();
  const commissionBps = await getMarketplaceCommissionBps();

  return (
    <CreatorSignupClient
      displayName={session?.fullName ?? session?.email ?? "Zybble creator"}
      email={session?.email ?? ""}
      commissionPercentLabel={(commissionBps / 100).toFixed(0)}
    />
  );
}