"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { markNotificationsRead } from "@/app/(learner)/actions";

/**
 * Server-fed admin portal context: only counters and the admin display name
 * that the sidebar/header need. All privileged data is fetched server-side.
 */
export interface AdminStudioValue {
  adminName: string;
  pendingReviewCount: number;
  openReportCount: number;
  notifications: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    read: boolean;
    createdAt: string;
  }>;
  markAllRead: (ids: string[]) => void;
}

const AdminStudioContext = createContext<AdminStudioValue | null>(null);

export function AdminStudioProvider({
  value,
  children,
}: {
  value: Omit<AdminStudioValue, "markAllRead">;
  children: React.ReactNode;
}) {
  const markAllRead = useCallback((ids: string[]) => {
    void markNotificationsRead(ids);
  }, []);

  const memo = useMemo<AdminStudioValue>(() => ({ ...value, markAllRead }), [value, markAllRead]);
  return <AdminStudioContext.Provider value={memo}>{children}</AdminStudioContext.Provider>;
}

export function useAdminStudio(): AdminStudioValue {
  const ctx = useContext(AdminStudioContext);
  if (!ctx) throw new Error("useAdminStudio must be used within AdminStudioProvider");
  return ctx;
}
