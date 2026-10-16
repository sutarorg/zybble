"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/config/catalog";
import {
  isChatbotPage,
  MAX_CONVERSATION_ENTRIES,
  MAX_MESSAGE_CHARS,
  type ChatRecommendation,
  type ChatReply,
} from "@/lib/chatbot";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
  recommendations?: ChatRecommendation[];
  link?: { href: string; label: string };
}
const WELCOME: Message = {
  role: "assistant",
  text: "Hi! I’m Zybble AI, your course guide. Tell me what you’d like to learn and I’ll help you find a course. I can also help with enrollment and other questions.",
};
/** Must cover the suggested-question collapse transition below. */
const SETTLE_MS = 320;

/** The terminal frame of a streamed reply. Deltas carry only text. */
type ChatStreamEvent =
  | { type: "done"; recommendations?: ChatRecommendation[]; link?: { href: string; label: string } }
  | { type: "error"; text: string; link?: { href: string; label: string } };

/**
 * Reads the `text/event-stream` body of `/api/chat`.
 *
 * Every `delta` frame is handed to `onDelta` as it lands, so the visitor reads
 * along instead of waiting for the whole answer. The last non-delta frame is
 * returned; it carries the course cards, which the server only builds once the
 * reply is complete and every slug has been checked against the catalog.
 */
async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<ChatStreamEvent | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ChatStreamEvent | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as
              | { type: "delta"; text: string }
              | ChatStreamEvent;
            if (event.type === "delta") onDelta(event.text);
            else final = event;
          } catch {
            // A malformed frame is skipped, never rendered.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return final;
}

/** Mounted only in the public shell, with an explicit discovery-route allowlist. */
export function PublicChatbot() {
  const pathname = usePathname();
  if (!isChatbotPage(pathname)) return null;
  // Navigating away closes the panel and clears the route-scoped conversation.
  return <ChatbotPanel key={pathname} categorySlug={pathname.split("/")[2]} />;
}

function ChatbotPanel({ categorySlug }: { categorySlug?: string }) {
  const category = CATEGORIES.find((item) => item.slug === categorySlug);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [thinking, setThinking] = useState(false);
  /** True once the first token has arrived — replaces the "Thinking…" bubble. */
  const [streaming, setStreaming] = useState(false);
  const sessionId = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);
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

  // A route change (which remounts the panel) must not leave a stream open.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Appends text to the assistant message currently being streamed. */
  function appendDelta(text: string) {
    setStreaming(true);
    setMessages((previous) => {
      const next = previous.slice();
      const index = next.length - 1;
      const target = next[index];
      if (!target || target.role !== "assistant") return previous;
      next[index] = { ...target, text: target.text + text };
      return next;
    });
  }

  /** Merges the validated tail of a reply — course cards and the help link. */
  function patchLastMessage(patch: Partial<Message>) {
    setMessages((previous) => {
      const next = previous.slice();
      const index = next.length - 1;
      const target = next[index];
      if (!target || target.role !== "assistant") return previous;
      next[index] = { ...target, ...patch };
      return next;
    });
  }

  async function send(text: string) {
    const trimmed = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed || thinking) return;

    const history: Message[] = [...messages, { role: "user" as const, text: trimmed }].slice(-MAX_CONVERSATION_ENTRIES);
    setMessages(history);
    setDraft("");
    setThinking(true);
    hideSuggestions();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: sessionId.current,
          category: category?.slug,
          stream: true,
          messages: history
            .filter((message) => message.role === "user" || message.text !== WELCOME.text)
            .map((message) => ({ role: message.role, content: message.text })),
        }),
      });

      // The endpoint answers with Server-Sent Events. Anything else — a proxy
      // that buffers the body, or an older deployment — falls back to the
      // plain JSON contract, so the panel never depends on streaming alone.
      if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
        setMessages((previous) => [...previous, { role: "assistant", text: "" }]);
        const final = await readChatStream(response.body, appendDelta);

        if (!final) {
          patchLastMessage({ text: "Zybble AI did not finish that answer. Please try again." });
        } else if (final.type === "done") {
          patchLastMessage({ recommendations: final.recommendations, link: final.link });
        } else {
          patchLastMessage({ text: final.text, link: final.link });
        }
      } else {
        const payload = (await response.json()) as ChatReply;
        if (!response.ok) throw new Error(payload.text ?? "Chat is unavailable");
        setMessages((previous) => [
          ...previous,
          { role: "assistant", text: payload.text, recommendations: payload.recommendations, link: payload.link },
        ]);
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: "Zybble AI is not answering right now. You can browse the catalog directly, or email us and a human will reply.",
        },
      ]);
    } finally {
      setStreaming(false);
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    abortRef.current?.abort();
    sessionId.current = crypto.randomUUID();
    setMessages([WELCOME]);
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
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">Course discovery, answered from the live catalog</Dialog.Description>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Start a new chat" onClick={reset}><RotateCcw aria-hidden /></Button>
            <Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close chat"><X aria-hidden /></Button></Dialog.Close>
          </div>

          <div ref={logRef} role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 scrollbar-thin">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="size-3" aria-hidden /> Let’s find your next course</div>
            {/* Shown only until the first token lands; the live bubble takes over. */}
            {thinking && !streaming ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="size-1.5 animate-bounce rounded-full bg-zinc-400"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                  <span className="sr-only">Zybble AI is thinking</span>
                </div>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                  // The streaming bubble is appended empty; hide it until the
                  // first token arrives so it never flashes as a grey pill.
                  message.role === "assistant" && !message.text ? "hidden" : null
                )}
              >
                <div className={cn("max-w-[92%] space-y-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed", message.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-muted text-foreground")}>
                  <span className="sr-only">{message.role === "user" ? "You: " : "Zybble AI: "}</span>
                  <p className="whitespace-pre-wrap break-anywhere">
                    {message.text}
                    {/* A caret tracks the write head while tokens are arriving. */}
                    {streaming && index === messages.length - 1 && message.role === "assistant" ? (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-px animate-pulse bg-zinc-400 align-middle" aria-hidden />
                    ) : null}
                  </p>
                  {message.recommendations?.map((course) => (
                    <Link key={course.id} href={`/courses/${course.slug}`} className="group block rounded-xl border border-border bg-white p-3 transition-colors hover:border-primary/40 hover:bg-accent/50">
                      <div className="flex items-start gap-2"><span className="flex-1 font-medium text-foreground">{course.title}</span><ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /></div>
                      <p className="mt-1 text-[11px] capitalize text-muted-foreground">{course.level} · {formatDuration(course.durationMinutes)} · {course.priceLabel}</p>
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
                    {suggestions.map((question) => <button key={question} type="button" onClick={() => void send(question)} className="cursor-pointer rounded-full border border-primary/15 bg-accent px-2.5 py-1.5 text-left text-[11px] font-medium text-accent-foreground transition-colors hover:border-primary/40 hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{question}</button>)}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={(event) => { event.preventDefault(); send(draft); }} className="flex items-center gap-2 rounded-xl border border-input bg-white p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/10">
              <label htmlFor="zybble-chat-message" className="sr-only">Your message</label>
              <input id="zybble-chat-message" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_MESSAGE_CHARS} autoComplete="off" placeholder="What would you like to learn?" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground sm:text-[13px]" />
              <Button type="submit" size="icon-sm" disabled={!draft.trim() || thinking} aria-label="Send message" className="rounded-lg"><Send aria-hidden /></Button>
            </form>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">AI answers, verified against published courses · Don’t share personal details</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
