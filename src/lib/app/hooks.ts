"use client";

import { useSyncExternalStore } from "react";
import {
  getLocalPostsServerSnapshot,
  getLocalPostsSnapshot,
  subscribeLocalPosts,
  type LocalPost,
} from "@/lib/app/local-posts";

/** Reactive access to the local preview post store (hydration-safe). */
export function useLocalPosts(): LocalPost[] {
  return useSyncExternalStore(
    subscribeLocalPosts,
    getLocalPostsSnapshot,
    getLocalPostsServerSnapshot,
  );
}

const hydratedListeners = new Set<never>();
const noopSubscribe = () => () => {};

/**
 * True after the client has mounted — used to defer rendering of local data
 * until the browser snapshot exists (server snapshot is always empty).
 */
export function useClientMounted(): boolean {
  void hydratedListeners;
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Detected IANA timezone of the visitor, stable across renders. */
export function useLocalTimezone(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}
