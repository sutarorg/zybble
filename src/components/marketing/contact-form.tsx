"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { siteConfig } from "@/lib/site";

/**
 * Public contact form.
 *
 * Posts JSON to /api/contact and renders the honest outcome: a success state
 * when the message was accepted for delivery, an error state with the direct
 * email address when it was not. A hidden "website" field acts as a honeypot
 * for bots — real users never see it.
 */

const TOPICS = [
  { value: "support", label: "Product support" },
  { value: "sales", label: "Plans and billing" },
  { value: "feedback", label: "Product feedback" },
  { value: "security", label: "Security" },
  { value: "other", label: "Something else" },
] as const;

const inputClass =
  "block w-full rounded-xl border-0 bg-white px-4 py-3 text-[15px] text-slate-900 ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>("support");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, website }),
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.ok) {
        setSent(true);
      } else {
        setError(
          payload?.error?.message ??
            "Something went wrong sending your message. Please try again, or email us directly.",
        );
      }
    } catch {
      setError("Your message could not be sent — check your connection and try again, or email us directly.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-xs"
      >
        <CheckCircle2 aria-hidden className="mx-auto size-10 text-emerald-500" />
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
          Message sent
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-7 text-slate-600">
          Thank you — your message is in the founder&rsquo;s inbox and will be read.
          If it needs a reply, it goes to <strong className="font-semibold text-slate-800">{email}</strong>.
        </p>
        <p className="mt-5 text-sm text-slate-500">
          Meanwhile, the{" "}
          <Link href="/free-linkedin-tools" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
            free LinkedIn tools
          </Link>{" "}
          are open all day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs sm:p-8" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Your name</span>
          <input
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1.5 ${inputClass}`}
            placeholder="Priya Sharma"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1.5 ${inputClass}`}
            placeholder="you@company.com"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">What is this about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${
                topic === t.value
                  ? "bg-brand-50 text-brand-800 ring-brand-300"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="topic"
                value={t.value}
                checked={topic === t.value}
                onChange={() => setTopic(t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Message</span>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`mt-1.5 ${inputClass} resize-y leading-7`}
          placeholder="How can we help? If it is a bug, tell us what you expected and what happened instead."
        />
        <span className="mt-1 block text-right text-xs tabular-nums text-slate-400">
          {message.length.toLocaleString()} / 5,000
        </span>
      </label>

      {/* Honeypot — visually hidden from humans, catnip for bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 ring-1 ring-red-100">
          {error}{" "}
          <a
            href={`mailto:${siteConfig.email.support}`}
            className="font-semibold underline underline-offset-2"
          >
            {siteConfig.email.support}
          </a>
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm leading-6 text-slate-500">
          Messages reach the founder directly. Prefer email?{" "}
          <a
            href={`mailto:${siteConfig.email.support}`}
            className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            {siteConfig.email.support}
          </a>
        </p>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-[15px] font-semibold text-white shadow-xs transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send aria-hidden className="size-4" />
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
