"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendMessage } from "@/app/(learner)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  mine: boolean;
  text: string;
  time: string;
}

export function MessageThread({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: Message[];
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <ul className="space-y-3 p-4">
        {messages.length === 0 ? (
          <li className="text-[13px] text-muted-foreground">No messages yet.</li>
        ) : (
          messages.map((message) => (
            <li key={message.id} className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                  message.mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                <p
                  className={cn(
                    "mt-1 text-[10.5px]",
                    message.mine ? "text-primary-foreground/70" : "text-zinc-400"
                  )}
                >
                  {timeAgo(message.time)}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const body = text.trim();
          if (!body) return;
          setBusy(true);
          setError(null);
          void sendMessage(conversationId, body)
            .then((result) => {
              if (!result.ok) setError(result.error ?? "Could not send the message");
              else {
                setText("");
                router.refresh();
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        <Textarea
          rows={2}
          aria-label="Write a reply"
          placeholder="Write a reply…"
          maxLength={4000}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send</span>
        </Button>
      </form>
      {error ? <p className="px-4 pb-3 text-[12.5px] text-red-600">{error}</p> : null}
    </div>
  );
}