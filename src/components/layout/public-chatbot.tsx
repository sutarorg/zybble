"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { useApp } from "@/components/providers/app-providers";
import { CATEGORIES, COURSES } from "@/data/mock-data";
import { answerChat, isChatbotPage, type ChatPreferences, type ChatReply } from "@/lib/chatbot";
import { formatDuration, formatPrice } from "@/lib/format";
import { translateCourse } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
  courses?: ChatReply["courses"];
  link?: ChatReply["link"];
}
const WELCOME: Message = {
  role: "assistant",
  text: "Hi! I’m Zybble AI, your course guide. Tell me what you’d like to learn and I’ll help you find a course. I can also help with enrollment and other questions.",
};
/** Must cover the suggested-question collapse transition below. */
const SETTLE_MS = 320;

/** Mounted only in the public shell, with an explicit discovery-route allowlist. */
export function PublicChatbot() {
  const pathname = usePathname();
  if (!isChatbotPage(pathname)) return null;
  // Navigating away closes the panel and clears the route-scoped conversation.
  return <ChatbotPanel key={pathname} categorySlug={pathname.split("/")[2]} />;
}

function ChatbotPanel({ categorySlug }: { categorySlug?: string }) {
  const category = CATEGORIES.find((item) => item.slug === categorySlug);
  const community = useCommunityCourses();
  const { language } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [preferences, setPreferences] = useState<ChatPreferences>({ category: category?.slug });
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settleRef = useRef<number | null>(null);
  const suggestions = [category ? `Explore ${category.name}` : "Find a beginner course", "Any free courses?", "How do I enroll?"];
  // The suggested questions are a one-time offer: they greet the visitor, then the first
  // answer collapses them for the rest of the conversation. `chipsMounted` keeps the block
  // in the DOM only while the collapse runs, so the chips leave the tab order afterwards.
  const [chipsMounted, setChipsMounted] = useState(true);
  const [chipsExpanded, setChipsExpanded] = useState(true);

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    // Re-anchored when the chips unmount too, so the log settles against the composer.
  }, [messages, open, chipsMounted]);

  // Never leave a pending settle timer behind when the panel unmounts (route change).
  useEffect(() => () => { if (settleRef.current !== null) window.clearTimeout(settleRef.current); }, []);

  function hideSuggestions() {
    if (!chipsMounted) return;
    setChipsExpanded(false);
    settleRef.current = window.setTimeout(() => setChipsMounted(false), SETTLE_MS);
  }

  function showSuggestions() {
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    setChipsMounted(true);
    // Mount collapsed, then expand on the next frame so the height transition runs.
    requestAnimationFrame(() => setChipsExpanded(true));
  }

  function send(text: string) {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;
    const reply = answerChat(trimmed, [...COURSES, ...community], preferences);
    setMessages((previous) => [...previous, { role: "user" as const, text: trimmed }, { role: "assistant" as const, ...reply }].slice(-60));
    setPreferences(reply.preferences);
    setDraft("");
    hideSuggestions();
    inputRef.current?.focus();
  }

  function reset() {
    setMessages([WELCOME]);
    setPreferences({ category: category?.slug });
    setDraft("");
    showSuggestions();
    inputRef.current?.focus();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger asChild>
        <Button
          aria-label="Chat with Zybble AI"
          // While the panel is open the launcher steps aside (fade + shrink) instead of
          // sitting under it. `aria-hidden`/`tabIndex` keep the invisible button out of the
          // tab order and the a11y tree; Radix still restores focus to it on close.
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          className={cn(
            "fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-2xl shadow-pop transition-all duration-200 ease-out sm:right-6 sm:bottom-6",
            open ? "pointer-events-none translate-y-2 scale-50 opacity-0" : "translate-y-0 scale-100 opacity-100"
          )}
        >
          <MessageCircle className="size-6!" aria-hidden />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          lang="en"
          onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-[min(600px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[380px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_60px_-12px_rgb(23_23_27/0.25)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-90 data-[state=open]:slide-in-from-bottom-4 data-[state=open]:duration-300 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:duration-200 data-[state=closed]:ease-in sm:right-6 sm:bottom-6"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-accent/70 px-4 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Bot className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-[15px] font-semibold">Zybble AI</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">A little help for your next big skill</Dialog.Description>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Start a new chat" onClick={reset}><RotateCcw aria-hidden /></Button>
            <Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close chat"><X aria-hidden /></Button></Dialog.Close>
          </div>

          <div ref={logRef} role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 scrollbar-thin">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="size-3" aria-hidden /> Let’s find your next course</div>
            {messages.map((message, index) => (
              <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[92%] space-y-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed", message.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-muted text-foreground")}>
                  <span className="sr-only">{message.role === "user" ? "You: " : "Zybble AI: "}</span>
                  <p className="whitespace-pre-wrap break-anywhere">{message.text}</p>
                  {message.courses?.map((course) => (
                    <Link key={course.id} href={`/courses/${course.slug}`} className="group block rounded-xl border border-border bg-white p-3 transition-colors hover:border-primary/40 hover:bg-accent/50">
                      <div className="flex items-start gap-2"><span className="flex-1 font-medium text-foreground">{translateCourse(course, language).title}</span><ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /></div>
                      <p className="mt-1 text-[11px] capitalize text-muted-foreground">{course.level} · {formatDuration(course.durationMinutes)} · {formatPrice(course.price)}</p>
                    </Link>
                  ))}
                  {message.link && <Link href={message.link.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{message.link.label}<ArrowUpRight className="size-3.5" aria-hidden /></Link>}
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-border bg-white px-4 pt-3 pb-4">
            {chipsMounted && (
              <div className={cn("grid transition-all duration-300 ease-out", chipsExpanded ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] -translate-y-1 opacity-0")}>
                <div className="min-h-0 overflow-hidden">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">Try asking</p>
                  <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Suggested questions">
                    {suggestions.map((question) => <button key={question} type="button" onClick={() => send(question)} className="cursor-pointer rounded-full border border-primary/15 bg-accent px-2.5 py-1.5 text-left text-[11px] font-medium text-accent-foreground transition-colors hover:border-primary/40 hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{question}</button>)}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={(event) => { event.preventDefault(); send(draft); }} className="flex items-center gap-2 rounded-xl border border-input bg-white p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/10">
              <label htmlFor="zybble-chat-message" className="sr-only">Your message</label>
              <input id="zybble-chat-message" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} autoComplete="off" placeholder="What would you like to learn?" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground sm:text-[13px]" />
              <Button type="submit" size="icon-sm" disabled={!draft.trim()} aria-label="Send message" className="rounded-lg"><Send aria-hidden /></Button>
            </form>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">Automated catalog help · Don’t share personal details</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
