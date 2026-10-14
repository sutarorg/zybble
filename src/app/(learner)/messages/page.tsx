import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { getConversations } from "@/lib/server/learner";
import { MessageThread } from "./message-thread";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Messages",
  description: "Conversations with your instructors and Zybble support.",
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const conversations = await getConversations();

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Messages</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Conversations with the Zybble operations team about orders, courses and moderation.
        </p>
      </header>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations"
          description="When you contact Zybble support about an order or a course, the thread appears here."
        />
      ) : (
        <div className="space-y-4">
          {conversations.map((conversation) => (
            <section key={conversation.id} className="rounded-xl border border-border bg-white shadow-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="font-display text-[14.5px] font-semibold tracking-tight">{conversation.subject}</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{conversation.name}</p>
              </header>
              <MessageThread conversationId={conversation.id} messages={conversation.messages} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}