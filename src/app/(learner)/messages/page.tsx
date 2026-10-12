import type { Metadata } from "next";
import { MessagesClient } from "./messages-client";

export const metadata: Metadata = {
  title: "Messages",
  description: "Conversations with your instructors and Zybble support.",
};

export default function MessagesPage() {
  return <MessagesClient />;
}
