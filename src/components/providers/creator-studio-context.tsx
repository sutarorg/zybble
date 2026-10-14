"use client";

import * as React from "react";
import { createContext, useContext, useMemo } from "react";

/**
 * Server-fed creator studio context.
 *
 * Every value here is read from Supabase on the server and passed down. The
 * client never authors a course, a status or a financial figure itself — it
 * calls a server action and the server re-reads the database.
 */
export interface StudioNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreatorStudioValue {
  displayName: string;
  initials: string;
  pendingCount: number;
  notifications: StudioNotification[];
  readNotificationIds: string[];
  markNotificationsRead: (ids: string[]) => void;
}

const CreatorStudioContext = createContext<CreatorStudioValue | null>(null);

export function CreatorStudioProvider({
  value,
  children,
}: {
  value: Omit<CreatorStudioValue, "readNotificationIds" | "markNotificationsRead"> & {
    readNotificationIds?: string[];
  };
  children: React.ReactNode;
}) {
  const [readNotificationIds, setRead] = React.useState<string[]>(value.readNotificationIds ?? []);

  const markNotificationsRead = React.useCallback((ids: string[]) => {
    setRead((previous) => Array.from(new Set([...previous, ...ids])));
    void fetch("/api/learner/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => undefined);
  }, []);

  const memo = useMemo<CreatorStudioValue>(
    () => ({
      displayName: value.displayName,
      initials: value.initials,
      pendingCount: value.pendingCount,
      notifications: value.notifications,
      readNotificationIds,
      markNotificationsRead,
    }),
    [value.displayName, value.initials, value.pendingCount, value.notifications, readNotificationIds, markNotificationsRead]
  );

  return <CreatorStudioContext.Provider value={memo}>{children}</CreatorStudioContext.Provider>;
}

export function useCreatorStudio(): CreatorStudioValue {
  const ctx = useContext(CreatorStudioContext);
  if (!ctx) throw new Error("useCreatorStudio must be used within CreatorStudioProvider");
  return ctx;
}
