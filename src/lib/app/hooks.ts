"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { apiGet, errorMessage } from "@/lib/api/client";
import type {
  AnalyticsOverview,
  BillingState,
  CalendarPost,
  DashboardPost,
  LinkedInAccount,
  LinkedInCapabilities,
  NotificationItem,
  PlanEntitlements,
  SessionState,
  NotificationPreferences,
  TeamRole,
  TeamRoster,
  UsageSummary,
  Workspace,
} from "@/lib/app/types";

/**
 * Client data hooks.
 *
 * Every hook reads from `/api/*` — the same endpoints the dashboard's own
 * server components would use — so there is no second, divergent data path and
 * no local cache pretending to be a database. Reads are cached for the lifetime
 * of the mount only; mutations call `reload()` (or the mutation helper) so the
 * UI always reflects what the server actually stored.
 */

export type Resource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Re-fetch. Safe to call from an event handler. */
  reload: () => void;
  /** Optimistic local overwrite (used after a successful mutation). */
  setData: (next: T | null) => void;
  /** Surface a mutation failure inside an already-loaded view. */
  setError: (message: string | null) => void;
};

export function useApiResource<T>(
  path: string | null,
  options: { params?: Record<string, string | number | boolean | undefined>; refreshMs?: number } = {},
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [nonce, setNonce] = useState(0);

  const params = options.params;
  const paramKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const refreshMs = options.refreshMs;

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);

    apiGet<T>(path, params, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setErrorState(null);
      })
      .catch((caught: unknown) => {
        if (cancelled || (caught instanceof Error && caught.name === "AbortError")) return;
        setErrorState(errorMessage(caught, "Could not load this data."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramKey, nonce, refreshMs]);

  useEffect(() => {
    if (!refreshMs || !path) return;

    const timer = setInterval(() => setNonce((value) => value + 1), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs, path]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data,
    error,
    loading,
    reload,
    setData,
    setError: setErrorState,
  };
}

/** The signed-in session, or null while loading / when signed out. */
export function useSession(): Resource<SessionState> {
  return useApiResource<SessionState>("/api/auth/session");
}

export function usePosts(
  params: { status?: DashboardPost["status"]; limit?: number } = {},
): Resource<DashboardPost[]> {
  const query = useApiResource<{ posts: DashboardPost[] }>("/api/posts", {
    params: { status: params.status, limit: params.limit ?? 100 },
  });

  return {
    data: query.data?.posts ?? null,
    error: query.error,
    loading: query.loading,
    reload: query.reload,
    setData: (next) => query.setData(next ? { posts: next } : null),
    setError: query.setError,
  };
}

export function useCalendar(from: string, to: string, timezone: string): Resource<CalendarPost[]> {
  const query = useApiResource<{ days: Record<string, CalendarPost[]> }>("/api/calendar", {
    params: { from, to, timezone },
  });

  const posts = useMemo(
    () => (query.data ? Object.values(query.data.days).flat() : null),
    [query.data],
  );

  return {
    data: posts,
    error: query.error,
    loading: query.loading,
    reload: query.reload,
    setData: () => undefined,
    setError: query.setError,
  };
}

export function useLinkedInAccounts(): Resource<{
  connections: LinkedInAccount[];
  capabilities: LinkedInCapabilities;
}> {
  return useApiResource<{ connections: LinkedInAccount[]; capabilities: LinkedInCapabilities }>(
    "/api/linkedin/accounts",
  );
}

export function useAnalytics(range: "7d" | "28d" | "12m" = "28d"): Resource<AnalyticsOverview> {
  return useApiResource<AnalyticsOverview>("/api/analytics", { params: { range } });
}

export function useBilling(): Resource<BillingState> {
  return useApiResource<BillingState>("/api/billing");
}

/** The active workspace (resolved server-side from the session cookie). */
export function useWorkspace(): Resource<{
  workspace: Workspace;
  role: TeamRole;
  entitlements: PlanEntitlements;
  usage: UsageSummary;
}> {
  return useApiResource<{
    workspace: Workspace;
    role: TeamRole;
    entitlements: PlanEntitlements;
    usage: UsageSummary;
  }>("/api/workspaces/current");
}

/** Email preferences, read before every send. */
export function useNotificationPreferences(): Resource<NotificationPreferences> {
  const query = useApiResource<{ preferences: NotificationPreferences }>(
    "/api/notifications/preferences",
  );

  return {
    data: query.data?.preferences ?? null,
    error: query.error,
    loading: query.loading,
    reload: query.reload,
    setData: () => undefined,
    setError: query.setError,
  };
}

/**
 * Usage for the active workspace.
 *
 * The `/current` alias resolves the workspace from the session cookie, so the
 * client never has to guess an id and never sends one.
 */
export function useUsage(): Resource<UsageSummary> {
  return useApiResource<UsageSummary>("/api/workspaces/current/usage");
}

export function useMembers(): Resource<TeamRoster> {
  return useApiResource<TeamRoster>("/api/workspaces/current/members");
}

export function useNotifications(limit = 20): Resource<NotificationItem[]> {
  const query = useApiResource<{ notifications: NotificationItem[] }>("/api/notifications", {
    params: { limit },
    refreshMs: 60_000,
  });

  return {
    data: query.data?.notifications ?? null,
    error: query.error,
    loading: query.loading,
    reload: query.reload,
    setData: () => undefined,
    setError: query.setError,
  };
}

/**
 * True after the client has mounted — used to defer rendering of data that only
 * exists in the browser (detected timezone, relative timestamps).
 */
export function useClientMounted(): boolean {
  const listeners = useRef(new Set<() => void>());
  return useSyncExternalStore(
    (listener) => {
      listeners.current.add(listener);
      return () => listeners.current.delete(listener);
    },
    () => true,
    () => false,
  );
}

/** Detected IANA timezone of the visitor, stable across renders. */
export function useLocalTimezone(): string {
  return useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}
