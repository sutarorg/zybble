import type { Metadata } from "next";
import { CreatorSignupClient } from "./creator-signup-client";

export const metadata: Metadata = {
  title: "Become a Creator - Zybble",
  description: "Join Zybble as a creator and start teaching. Share your knowledge and earn money.",
};

export default function CreatorSignupPage() {
  return <CreatorSignupClient />;
}
