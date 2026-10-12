"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/* Mount detection                                                             */
/* -------------------------------------------------------------------------- */

const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

/**
 * True after the component has hydrated on the client.
 *
 * Implemented with `useSyncExternalStore` so React renders `false` on the
 * server, hydrates with `false` and then re-renders with `true` — without a
 * setState-in-effect cascade (and without hydration mismatches).
 */
export function useMounted() {
  return useSyncExternalStore(subscribeNoop, getMountedSnapshot, getServerMountedSnapshot);
}

/* -------------------------------------------------------------------------- */
/* Media queries                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Tracks a CSS media query. Returns `false` during SSR/first render so markup
 * matches the server output, then syncs after hydration.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false
  );
}

/** True for viewports at/above Tailwind's `lg` breakpoint (1024px). */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}

/* -------------------------------------------------------------------------- */
/* Keyed state                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * State that resets to `initial` whenever `key` changes, computed during the
 * render instead of inside an effect.
 *
 * Typical use: paging/filter screens where changing a filter must reset the
 * page number without a cascading setState-in-effect render.
 *
 * `initial` is only used as the starting value for a new key — keep it a plain
 * value (or wrap it in `useMemo` if it is built on the fly).
 */
export function useKeyedState<T>(key: string, initial: T) {
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: initial }));

  const value = state.key === key ? state.value : initial;

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const current = prev.key === key ? prev.value : initial;
        return {
          key,
          value: typeof next === "function" ? (next as (p: T) => T)(current) : next,
        };
      });
    },
    [key, initial]
  );

  return [value, update] as const;
}

/* -------------------------------------------------------------------------- */
/* localStorage-backed store                                                   */
/* -------------------------------------------------------------------------- */

interface StorageStore<T> {
  key: string;
  fallback: T;
  listeners: Set<() => void>;
  /** Raw string the cached value was parsed from (`undefined` = not read yet). */
  cachedRaw: string | null | undefined;
  cachedValue: T;
}

const stores = new Map<string, StorageStore<unknown>>();

/** Listeners for the cross-tab `storage` event are registered once. */
let storageListenerAttached = false;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    /* storage unavailable (private mode, blocked cookies) */
    return null;
  }
}

function parseOrFallback<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function getStore<T>(key: string, fallback: T): StorageStore<T> {
  const existing = stores.get(key);
  if (existing) return existing as StorageStore<T>;
  const store: StorageStore<T> = {
    key,
    fallback,
    listeners: new Set(),
    cachedRaw: undefined,
    cachedValue: fallback,
  };
  stores.set(key, store as StorageStore<unknown>);
  return store;
}

/**
 * Snapshot must be referentially stable between store notifications, so the
 * parsed value is cached alongside the raw string it came from.
 */
function getStoreSnapshot<T>(store: StorageStore<T>): T {
  const raw = readRaw(store.key);
  if (raw === store.cachedRaw) return store.cachedValue;
  store.cachedRaw = raw;
  store.cachedValue = parseOrFallback(raw, store.fallback);
  return store.cachedValue;
}

function getServerSnapshot<T>(store: StorageStore<T>): T {
  return store.fallback;
}

function emit(store: StorageStore<unknown>) {
  store.listeners.forEach((listener) => listener());
}

function subscribeToStore(store: StorageStore<unknown>, listener: () => void) {
  store.listeners.add(listener);
  if (!storageListenerAttached && typeof window !== "undefined") {
    storageListenerAttached = true;
    // Keep tabs in sync when the same demo state is open twice.
    window.addEventListener("storage", (event) => {
      const changed = event.key ? stores.get(event.key) : undefined;
      if (changed) {
        changed.cachedRaw = undefined;
        emit(changed);
      } else {
        stores.forEach((s) => {
          s.cachedRaw = undefined;
          emit(s);
        });
      }
    });
  }
  return () => {
    store.listeners.delete(listener);
  };
}

function writeRaw(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

/**
 * Writes a value, invalidates the cached snapshot and notifies subscribers.
 * Kept outside the hook so the store object is never mutated in hook scope.
 */
function writeStore(key: string, value: unknown) {
  writeRaw(key, value);
  const store = stores.get(key);
  if (!store) return;
  store.cachedRaw = undefined;
  emit(store);
}

/**
 * `useState`-like state persisted to localStorage.
 *
 * Reads go through `useSyncExternalStore`: the server (and the hydration
 * render) uses `initialValue`, then React swaps in the stored value in the
 * same commit that flips `hydrated` to true — so the UI never shows
 * contradictory pre/post-hydration values, and no setState-in-effect is
 * required. Writes notify every hook instance subscribed to the same key.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const store = useMemo(() => getStore(key, initialValue), [key, initialValue]);

  const value = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeToStore(store as StorageStore<unknown>, listener),
      [store]
    ),
    useCallback(() => getStoreSnapshot(store), [store]),
    useCallback(() => getServerSnapshot(store), [store])
  );

  const hydrated = useMounted();

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = getStoreSnapshot(store);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeStore(store.key, resolved);
    },
    [store]
  );

  const clear = useCallback(() => {
    writeStore(store.key, null);
  }, [store]);

  return { value, set, clear, hydrated } as const;
}
