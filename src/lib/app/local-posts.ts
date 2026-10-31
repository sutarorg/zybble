"use client";

/**
 * Local preview post store.
 *
 * Prompt 2 is frontend-only: posts created in the composer are held in
 * localStorage so the interface is genuinely interactive. The UI always
 * labels these as "local preview — not synced". Prompt 3 replaces this module
 * with Supabase queries; the component contracts (fields below) already match
 * the production schema subset.
 *
 * Implemented as an external store so React hydration is mismatch-free and no
 * effect-driven setState is needed.
 */

export type LocalPostStatus = "draft" | "scheduled";

export interface LocalPost {
  id: string;
  text: string;
  media: { id: string; name: string; mimeType: string; bytes: number }[];
  status: LocalPostStatus;
  /** ISO instant — only when status === "scheduled". */
  scheduledAt: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
  localPreview: true;
}

const STORAGE_KEY = "zybble.local-posts.v1";
const EMPTY: LocalPost[] = [];

let cache: LocalPost[] | null = null;
const listeners = new Set<() => void>();

function read(): LocalPost[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache === null) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      cache = raw ? (JSON.parse(raw) as LocalPost[]) : [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

function write(next: LocalPost[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable — keep the in-memory copy; UI stays honest.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLocalPosts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable snapshot — never allocate in getSnapshot. */
export function getLocalPostsSnapshot(): LocalPost[] {
  return read();
}

export function getLocalPostsServerSnapshot(): LocalPost[] {
  return EMPTY;
}

export function getLocalPost(id: string): LocalPost | undefined {
  return read().find((p) => p.id === id);
}

export function createLocalPost(
  input: Pick<LocalPost, "text" | "media" | "status" | "scheduledAt" | "timezone">,
): LocalPost {
  const now = new Date().toISOString();
  const post: LocalPost = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    localPreview: true,
  };
  write([...read(), post].sort(sortByScheduleThenCreated));
  return post;
}

export function updateLocalPost(id: string, patch: Partial<Omit<LocalPost, "id">>) {
  write(
    read()
      .map((p) => (p.id === id ? { ...p, ...patch, id, updatedAt: new Date().toISOString() } : p))
      .sort(sortByScheduleThenCreated),
  );
}

export function deleteLocalPost(id: string) {
  write(read().filter((p) => p.id !== id));
}

function sortByScheduleThenCreated(a: LocalPost, b: LocalPost) {
  if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
  if (a.scheduledAt) return -1;
  if (b.scheduledAt) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Used by scheduling-limit messaging (Free = 10/month). */
export function countScheduledThisMonth(posts: LocalPost[], now = new Date()) {
  return posts.filter((p) => {
    if (p.status !== "scheduled" || !p.scheduledAt) return false;
    const d = new Date(p.scheduledAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}
