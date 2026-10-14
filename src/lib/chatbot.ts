import type { CourseLevel } from "@/types";

/**
 * Zybble AI — client-side contract.
 *
 * The assistant itself is an OpenRouter-backed server endpoint (`/api/chat`).
 * This module holds only what the browser needs: the route allowlist that
 * decides where the launcher appears, and the shapes for a reply.
 */

export interface ChatPreferences {
  category?: string;
  topic?: string[];
  level?: CourseLevel;
  /** Budget in integer paise. Zybble is INR-only, so there is no currency field. */
  maxPricePaise?: number;
  maxMinutes?: number;
}

export interface ChatRecommendation {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  category: string;
  level: string;
  durationMinutes: number;
  lessonsCount: number;
  /** Already formatted as INR by the server. */
  priceLabel: string;
}

export interface ChatReply {
  text: string;
  recommendations?: ChatRecommendation[];
  link?: { href: string; label: string };
  error?: "unavailable" | "rate_limited" | "invalid_response";
}

/**
 * Deliberately limited to public discovery pages, regardless of account role.
 */
export function isChatbotPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/explore" ||
    /^\/categories\/[a-z0-9-]+\/?$/.test(pathname)
  );
}

/** Maximum characters accepted in a single user message. */
export const MAX_MESSAGE_CHARS = 500;
/** Conversation entries retained in the browser, matching the server cap. */
export const MAX_CONVERSATION_ENTRIES = 60;
