"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Eraser, SendHorizonal, Sparkles, X } from "lucide-react";
import type { Course, TutorMessage } from "@/types";
import type { FlatLesson } from "@/lib/learn";
import { useApp } from "@/components/providers/app-providers";
import { answerTutor, tutorGreeting, tutorMessage, tutorSuggestions } from "@/lib/tutor";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function TutorPanel({
  course,
  currentLesson,
  onCitationClick,
  onClose,
  className,
}: {
  course: Course;
  currentLesson: FlatLesson;
  onCitationClick?: (lessonId: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const { tutorChats, appendTutorMessages, clearTutorChat } = useApp();
  const messages = useMemo(() => tutorChats[course.id] ?? [], [tutorChats, course.id]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Seed a greeting the first time the tutor opens for this course
  useEffect(() => {
    if (messages.length === 0) {
      appendTutorMessages(course.id, [tutorGreeting(course)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  const suggestions = useMemo(
    () => tutorSuggestions(course, currentLesson.lesson.id),
    [course, currentLesson.lesson.id]
  );

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || typing) return;
    const userMsg = tutorMessage("user", q);
    appendTutorMessages(course.id, [userMsg]);
    setInput("");
    setTyping(true);

    // Deterministic local "response" after a simulated thinking pause
    window.setTimeout(() => {
      const answer = answerTutor(course, q, currentLesson.lesson.id);
      appendTutorMessages(course.id, [tutorMessage("assistant", answer.text, answer.citations)]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-white", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <Bot className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">AI Tutor</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            Answers only about “{course.title}”
          </p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-amber-700 uppercase">
          Preview — AI not connected
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI Tutor"
          className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 scrollbar-thin">
        {messages.map((msg: TutorMessage) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs",
                msg.role === "user"
                  ? "rounded-br-md bg-primary text-white"
                  : "rounded-bl-md border border-border bg-white"
              )}
            >
              <p className="whitespace-pre-line">{msg.text}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border/70 pt-2">
                  {msg.citations.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => c.lessonId && onCitationClick?.(c.lessonId)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-left text-[10.5px] font-medium text-accent-foreground transition-colors hover:bg-violet-100"
                    >
                      <Sparkles className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className={cn("mt-1.5 text-right text-[10px]", msg.role === "user" ? "text-white/70" : "text-zinc-400")}>
                {fmtTime(msg.at)}
              </p>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-white px-3.5 py-3 shadow-xs">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-zinc-400"
                  style={{ animationDelay: `${i * 140}ms` }}
                  aria-hidden
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="border-t border-border bg-white px-4 pt-3">
        <div className="flex snap-x gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={typing}
              className="h-7.5 shrink-0 cursor-pointer snap-start rounded-full border border-violet-200 bg-accent px-3 text-[11.5px] font-medium whitespace-nowrap text-accent-foreground transition-colors hover:bg-violet-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => clearTutorChat(course.id)}
            title="Clear this conversation"
            className="flex h-7.5 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border px-2.5 text-[11px] text-zinc-400 transition-colors hover:text-foreground"
          >
            <Eraser className="size-3" aria-hidden />
            Clear
          </button>
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-border bg-white p-3"
      >
        <label htmlFor="tutor-input" className="sr-only">
          Ask the AI Tutor
        </label>
        <input
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this course…"
          className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-[13px] outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          aria-label="Send question"
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizonal className="size-4.5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
