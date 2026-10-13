import type { Metadata } from "next";
import { HelpClient } from "./help-client";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Answers about courses, enrollment, billing, certificates and your Zybble account.",
};

export default function HelpPage() {
  return <HelpClient />;
}
