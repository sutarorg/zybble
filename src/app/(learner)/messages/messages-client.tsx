"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, SendHorizonal } from "lucide-react";
import { CONVERSATIONS } from "@/data/mock-data";
import type { ChatMessage, Conversation } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const CANNED_REPLIES = [
  "Thanks for reaching out — I'll get back to you with a detailed answer shortly. (This is a simulated demo reply.)",
  "Great question! The course Q&A has a full thread on this — check lesson 2. (Simulated demo reply.)",
  "Happy to help. Give it a try and let me know how it goes! (Simulated demo reply.)",
];

export function MessagesClient() {
  const [threads, setThreads] = useState<Conversation[]>(CONVERSATIONS);
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const replyIndex = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active.messages.length, activeId]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const mine: ChatMessage = {
      id: `local_${Date.now()}`,
      sender: "me",
      text,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
    setThreads((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, messages: [...t.messages, mine] } : t))
    );
    setDraft("");

    // Simulated conversation partner
    const reply = CANNED_REPLIES[replyIndex.current++ % CANNED_REPLIES.length];
    window.setTimeout(() => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  {
                    id: `auto_${Date.now()}`,
                    sender: "them" as const,
                    text: reply,
                    time: new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }),
                  },
                ],
              }
            : t
        )
      );
    }, 1200);
  };

  const threadList = (
    <nav aria-label="Conversations" className="flex h-full flex-col">
      <p className="px-4 pt-5 pb-3 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
        Messages
      </p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {threads.map((thread) => {
          const last = thread.messages[thread.messages.length - 1];
          const selected = thread.id === activeId;
          return (
            <li key={thread.id}>
              <button
                type="button"
                aria-current={selected}
                onClick={() => {
                  setActiveId(thread.id);
                  setMobileThread(true);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors",
                  selected ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <span className="relative shrink-0">
                  <Avatar className="size-10">
                    <AvatarFallback className={cn("text-[12px]", thread.avatarColor)}>
                      {thread.initials}
                    </AvatarFallback>
                  </Avatar>
                  {thread.online && (
                    <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-label="Online" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{thread.name}</span>
                    <span className="shrink-0 text-[11px] text-zinc-400">{last?.time}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-muted-foreground">
                    {last?.sender === "me" ? "You: " : ""}
                    {last?.text}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const threadView = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <button
          type="button"
          onClick={() => setMobileThread(false)}
          aria-label="Back to conversations"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
        >
          <ArrowLeft className="size-4.5" />
        </button>
        <Avatar className="size-10">
          <AvatarFallback className={cn("text-[12px]", active.avatarColor)}>
            {active.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{active.name}</p>
          <p className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
            {active.online && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />}
            {active.role}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-5 scrollbar-thin">
        {active.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.sender === "me" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-xs",
                msg.sender === "me"
                  ? "rounded-br-md bg-primary text-white"
                  : "rounded-bl-md border border-border bg-white text-foreground"
              )}
            >
              <p>{msg.text}</p>
              <p
                className={cn(
                  "mt-1 text-right text-[10.5px]",
                  msg.sender === "me" ? "text-white/70" : "text-zinc-400"
                )}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-white p-3">
        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <input
          id="message-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${active.name.split(" ")[0]}…`}
          className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizonal className="size-4.5" aria-hidden />
        </button>
      </form>
    </div>
  );

  return (
    <div className="mx-auto max-w-340 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="mb-6 md:hidden">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Chat with instructors and support. Replies are simulated in this demo.
        </p>
      </header>
      <div className="h-[calc(100dvh-16rem)] min-h-105 overflow-hidden rounded-2xl border border-border bg-white shadow-card md:h-[calc(100dvh-13rem)]">
        <div className="grid h-full md:grid-cols-[300px_minmax(0,1fr)]">
          <div className={cn("h-full border-r border-border", mobileThread ? "hidden md:block" : "block")}>
            {threadList}
          </div>
          <div className={cn("h-full min-h-0", mobileThread ? "block" : "hidden md:block")}>
            {active ? threadView : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="size-8 text-zinc-300" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">Select a conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
